import type { JoinRoomRequest, JoinRoomResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";

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
  void req;
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { p_code: code.toUpperCase() });
  if (error || !data) {
    const message = error?.message ?? "ルームへの参加に失敗しました。";
    if (message.includes("ROOM_NOT_FOUND")) {
      throw new ApplicationError("ROOM_NOT_FOUND", message);
    }
    throw new ApplicationError("ROOM_FULL", `${message}（user: ${userId}）`);
  }
  return { gameId: data };
}
