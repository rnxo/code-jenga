import type { GetGameResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";

// GET /api/games/[gameId] — 試合状態の取得。Realtime の初期値・再接続時のフォールバック用。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const data = await handleGetGame(gameId);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleGetGame(gameId: string): Promise<GetGameResponse> {
  throw new Error(`未実装: GET /api/games/${gameId}`);
}
