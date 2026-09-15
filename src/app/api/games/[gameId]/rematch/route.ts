import type { RematchGameResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { rematchGame } from "@/lib/server/game/rematch-game";

// POST /api/games/[gameId]/rematch — 再戦を申し出て次局に参加する（backend-todo 1-6 / DB_DESIGN.md 5章-6）
// 前局の現役参加者なら誰でも呼べる。次局が無ければ作り、呼んだ本人だけを次局に登録する（冪等）。
// 参加者チェックは rematchGame 側で行う（退出済みの判定も含む）。
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
  const playerId = await requireUserId();
  return rematchGame({ gameId, playerId });
}
