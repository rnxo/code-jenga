import type { LeaveGameResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { leaveGame } from "@/lib/server/game/leave-game";

// POST /api/games/[gameId]/leave — 試合からの離脱（backend-todo 1-7）
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const data = await handleLeaveGame(gameId);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleLeaveGame(gameId: string): Promise<LeaveGameResponse> {
  const playerId = await requireUserId();
  return leaveGame({ gameId, playerId });
}
