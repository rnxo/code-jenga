import type { UpdateGameLanguageRequest, UpdateGameLanguageResponse } from "@/types/api";
import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { findGameById, updateGame } from "@/lib/server/repositories/games";
import { findRoomById } from "@/lib/server/repositories/rooms";
import { parseJsonBody, parseUpdateGameLanguageRequest } from "@/lib/server/validation";

// PATCH /api/games/[gameId]/language — ロビーでの実行言語の変更
// 担当: BE-A
//
// ホストだけが、試合開始前（status='waiting'）に限って変更できる。
// 認可は start/route.ts と同じく Route Handler 内で行う（書き込みは service role に一元化する方針）。
// 更新された games 行は Realtime で参加者全員のロビーに届く。

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const req = parseUpdateGameLanguageRequest(await parseJsonBody(request));
    const data = await handleUpdateLanguage(gameId, req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleUpdateLanguage(
  gameId: string,
  req: UpdateGameLanguageRequest,
): Promise<UpdateGameLanguageResponse> {
  const userId = await requireUserId();
  const game = await findGameById(gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  const room = await findRoomById(game.room_id);
  if (!room || room.host_id !== userId) {
    throw new ApplicationError("FORBIDDEN", "実行言語を変更できるのはホストだけです。");
  }
  if (game.status !== "waiting") {
    throw new ApplicationError("GAME_NOT_PLAYING", "試合開始後に実行言語は変更できません。");
  }
  return { game: await updateGame(gameId, { language: req.language }) };
}
