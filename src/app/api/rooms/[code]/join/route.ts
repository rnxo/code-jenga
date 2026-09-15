import type { JoinRoomRequest, JoinRoomResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { updateNickname } from "@/lib/server/repositories/profiles";
import { parseJoinRoomRequest, parseJsonBody } from "@/lib/server/validation";

// POST /api/rooms/[code]/join — 入室（DB_DESIGN.md 5章-3, 6章「入室処理だけが例外」）
// join_room(code) RPC（SECURITY DEFINER）を呼び出す。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { code } = await params;
    const req = parseJoinRoomRequest(await parseJsonBody(request));
    const data = await handleJoinRoom(code, req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleJoinRoom(code: string, req: JoinRoomRequest): Promise<JoinRoomResponse> {
  const userId = await requireUserId();
  if (req.nickname !== undefined) await updateNickname(userId, req.nickname);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_room", { p_code: code.toUpperCase() });
  if (error || !data) {
    const message = error?.message ?? "ルームへの参加に失敗しました。";
    if (message.includes("ROOM_NOT_FOUND")) throw new ApplicationError("ROOM_NOT_FOUND", "ルームが見つかりません。");
    if (message.includes("ROOM_CLOSED")) throw new ApplicationError("ROOM_CLOSED", "このルームは既に終了しています。");
    if (message.includes("GAME_NOT_READY")) throw new ApplicationError("GAME_NOT_READY", "参加可能な試合がありません。");
    if (message.includes("UNAUTHENTICATED")) throw new ApplicationError("UNAUTHENTICATED", "認証が必要です。");
    throw new ApplicationError("ROOM_FULL", "ルームの参加人数が上限に達しています。");
  }
  return { gameId: data };
}
