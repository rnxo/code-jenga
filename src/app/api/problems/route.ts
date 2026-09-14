import type { CreateProblemRequest, CreateProblemResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createProblem } from "@/lib/server/repositories/problems";
import { generateProblem } from "@/lib/server/gemini/generate-problem";

// POST /api/problems — お題生成＋Piston事前検証（DB_DESIGN.md 5章-2）
// 実装は @/lib/server/gemini/generate-problem と @/lib/server/piston/run に委譲する想定。
// 担当: BE-B

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
  const generated = await generateProblem(req.difficulty);
  if (generated.language !== "typescript") {
    throw new ApplicationError("PROBLEM_GENERATION_FAILED", "対応していない言語のお題が生成されました。");
  }
  const problem = await createProblem({
    sourceCode: generated.sourceCode,
    testCode: generated.testCode,
    language: generated.language,
    initialLineCount: generated.sourceCode.split("\n").length,
    generatedBy: "gemini",
    difficulty: req.difficulty,
  });
  return { problem };
}
