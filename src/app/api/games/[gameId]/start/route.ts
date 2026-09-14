import type { StartGameRequest, StartGameResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";

// POST /api/games/[gameId]/start — 試合開始（DB_DESIGN.md 5章-4）
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const body: unknown = await request.json();
    const req = body as StartGameRequest;
    const data = await handleStartGame(gameId, req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleStartGame(
  gameId: string,
  req: StartGameRequest,
): Promise<StartGameResponse> {
  throw new Error(`未実装: POST /api/games/${gameId}/start body=${JSON.stringify(req)}`);
}
