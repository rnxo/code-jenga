import type { CreateRoomRequest, CreateRoomResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";

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
  throw new Error(`未実装: POST /api/rooms body=${JSON.stringify(req)}`);
}
