import type { CreateProblemRequest, CreateProblemResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";

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
  throw new Error(`未実装: POST /api/problems body=${JSON.stringify(req)}`);
}
