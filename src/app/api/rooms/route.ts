import type { CreateRoomRequest, CreateRoomResponse } from "@/types/api";
import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { generateRoomCode } from "@/lib/shared/room-code";
import { createGame } from "@/lib/server/repositories/games";
import { addGamePlayer } from "@/lib/server/repositories/game-players";
import { createRoom } from "@/lib/server/repositories/rooms";

// POST /api/rooms — ルーム作成（DB_DESIGN.md 5章-1）
// rooms へ1行 INSERT → games(status='waiting', round_no=1) を INSERT
// → ホスト自身を game_players(turn_order=0) へ INSERT。
// 担当: BE-A

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const req = body as CreateRoomRequest;
    const data = await handleCreateRoom(req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleCreateRoom(req: CreateRoomRequest): Promise<CreateRoomResponse> {
  const userId = await requireUserId();
  const maxPlayers = req.maxPlayers ?? 4;
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
    throw new ApplicationError("VALIDATION_ERROR", "最大参加人数は2〜8人で指定してください。");
  }
  const room = await createRoom({ hostId: userId, code: generateRoomCode(), maxPlayers });
  const game = await createGame({ roomId: room.id, roundNo: 1 });
  await addGamePlayer({ gameId: game.id, playerId: userId, turnOrder: 0 });
  return { room, game };
}
