import type { GetGameResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { findGameById } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { listTurnsByGameId } from "@/lib/server/repositories/turns";

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
  const userId = await requireUserId();
  const game = await findGameById(gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  const players = await listGamePlayers(gameId);
  if (!players.some((player) => player.player_id === userId)) {
    throw new ApplicationError("UNAUTHENTICATED", "この試合を閲覧する権限がありません。");
  }
  return { game, players, turns: await listTurnsByGameId(gameId) };
}
