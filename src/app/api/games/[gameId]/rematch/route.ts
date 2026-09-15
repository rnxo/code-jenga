import type { RematchGameResponse } from "@/types/api";
import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { rematchGame } from "@/lib/server/game/rematch-game";

// POST /api/games/[gameId]/rematch — 再戦用の次局を作成（backend-todo 1-6 / DB_DESIGN.md 5章-6）
// 前局の参加者なら誰でも呼べる（冪等: 既に次局があればそれを返す）。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const data = await handleRematchGame(gameId);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleRematchGame(gameId: string): Promise<RematchGameResponse> {
  const userId = await requireUserId();
  const players = await listGamePlayers(gameId);
  if (!players.some((player) => player.player_id === userId)) {
    throw new ApplicationError("FORBIDDEN", "この試合の参加者ではありません。");
  }
  return rematchGame({ gameId });
}
