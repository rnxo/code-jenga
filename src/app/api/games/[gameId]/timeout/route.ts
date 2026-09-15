import type { TimeoutTurnResponse } from "@/types/api";
import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { timeoutTurn } from "@/lib/server/game/timeout-turn";

// POST /api/games/[gameId]/timeout — 制限時間切れの確定（backend-todo 1-1）
// 参加者なら誰が叩いてもよい。締切を過ぎているかはサーバー側の時刻で検証する。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const data = await handleTimeoutTurn(gameId);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleTimeoutTurn(gameId: string): Promise<TimeoutTurnResponse> {
  const userId = await requireUserId();
  const players = await listGamePlayers(gameId);
  if (!players.some((player) => player.player_id === userId)) {
    throw new ApplicationError("UNAUTHENTICATED", "この試合の参加者ではありません。");
  }
  return timeoutTurn({ gameId });
}
