import type { CreateProblemRequest, CreateProblemResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createProblem } from "@/lib/server/repositories/problems";
import { generateProblem } from "@/lib/server/gemini/generate-problem";
import { verifyProblem } from "@/lib/server/piston/verify-problem";

// POST /api/problems — お題生成＋Piston事前検証（DB_DESIGN.md 5章-2）
// Gemini で生成 → problems に保存 → Piston で削除前の状態が全テスト通過することを確認 → is_verified=true。
// 検証に失敗したら再生成を試み、上限まで失敗したら PROBLEM_GENERATION_FAILED を返す。
// 担当: BE-B

/** 生成＋検証の最大試行回数（Gemini の揺れとハーネス未対応構文の両方を吸収する）。 */
const MAX_ATTEMPTS = 3;

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const req = body as CreateProblemRequest;
    const data = await handleCreateProblem(req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleCreateProblem(req: CreateProblemRequest): Promise<CreateProblemResponse> {
  await requireUserId();
  const reasons: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const generated = await generateProblem(req.difficulty);
    if (generated.language !== "typescript") {
      throw new ApplicationError("PROBLEM_GENERATION_FAILED", "対応していない言語のお題が生成されました。");
    }
    // 不合格のお題も削除せず残す（is_verified=false のままなのでゲームには使われない。失敗パターンの分析用）。
    const problem = await createProblem({
      sourceCode: generated.sourceCode,
      testCode: generated.testCode,
      language: generated.language,
      initialLineCount: generated.sourceCode.split("\n").length,
      generatedBy: "gemini",
      difficulty: req.difficulty,
    });
    const verification = await verifyProblem({
      problemId: problem.id,
      sourceCode: problem.source_code,
      testCode: problem.test_code,
      language: problem.language,
    });
    if (verification.verified) {
      return { problem: { ...problem, is_verified: true } };
    }
    reasons.push(`${attempt}回目: ${verification.reason ?? "不明"}`);
  }

  throw new ApplicationError(
    "PROBLEM_GENERATION_FAILED",
    `お題の事前検証に ${MAX_ATTEMPTS} 回失敗しました。${reasons.join(" / ")}`,
  );
}
