import type { StartGameRequest, StartGameResponse } from "@/types/api";
import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { findGameById } from "@/lib/server/repositories/games";
import { findRoomById } from "@/lib/server/repositories/rooms";
import { startGame } from "@/lib/server/game/start-game";

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
  const userId = await requireUserId();
  const game = await findGameById(gameId);
  const room = game ? await findRoomById(game.room_id) : null;
  if (!game || !room || room.host_id !== userId) {
    throw new ApplicationError("UNAUTHENTICATED", "試合開始権限がありません。");
  }
  return { game: await startGame({ gameId, turnTimeLimitSeconds: req.turnTimeLimitSeconds ?? game.turn_time_limit_seconds }) };
}
