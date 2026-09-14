import type { JoinRoomRequest, JoinRoomResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";

// POST /api/rooms/[code]/join — 入室（DB_DESIGN.md 5章-3, 6章「入室処理だけが例外」）
// join_room(code) RPC（SECURITY DEFINER）を呼び出す。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { code } = await params;
    const body: unknown = await request.json();
    const req = body as JoinRoomRequest;
    const data = await handleJoinRoom(code, req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleJoinRoom(code: string, req: JoinRoomRequest): Promise<JoinRoomResponse> {
  throw new Error(`未実装: POST /api/rooms/${code}/join body=${JSON.stringify(req)}`);
}
