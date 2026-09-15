import type { CreateProblemRequest, CreateProblemResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { generateVerifiedProblem } from "@/lib/server/problems/prepare-problem";
import { enforceUserRateLimit } from "@/lib/server/rate-limit";
import { parseCreateProblemRequest, parseJsonBody } from "@/lib/server/validation";

// POST /api/problems — お題生成＋Piston事前検証（DB_DESIGN.md 5章-2）
// Gemini で生成 → problems に保存 → Piston で削除前の状態が全テスト通過することを確認 → is_verified=true。
// 検証に失敗したら再生成を試み、上限まで失敗したら PROBLEM_GENERATION_FAILED を返す。
// 担当: BE-B

export async function POST(request: Request): Promise<Response> {
  try {
    const req = parseCreateProblemRequest(await parseJsonBody(request));
    const data = await handleCreateProblem(req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleCreateProblem(req: CreateProblemRequest): Promise<CreateProblemResponse> {
  const userId = await requireUserId();
  enforceUserRateLimit(userId, "problem-generation");
  const problem = await generateVerifiedProblem(req.difficulty);
  if (!problem) {
    throw new ApplicationError("PROBLEM_GENERATION_FAILED", "お題の事前検証に3回失敗しました。");
  }
  return { problem };
}
