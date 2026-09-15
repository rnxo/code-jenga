import "server-only";

import type { Game } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { findGameById, updateGameIfCurrent } from "@/lib/server/repositories/games";
import { updateRoomStatus } from "@/lib/server/repositories/rooms";

// 担当: BE-A
// backend-todo 1-1: 制限時間切れ（timeout）の確定。
//
// 方式 (a): クライアント（参加者なら誰でも）が POST /api/games/[gameId]/timeout を叩き、
// サーバーが turn_deadline_at を過ぎていることを検証してから確定する。
// 更新は「status='playing' かつ turn_no が読んだ時点と同じ かつ deadline < now」の
// 条件付き UPDATE で行い、直前に手が確定していた場合は何も変更しない。
//
// 注: turns テーブルは deleted_line_no > 0 を要求するため timeout では turns 行を作らず、
// games.finish_reason='timeout' / loser_id で表現する。

export interface TimeoutTurnInput {
  gameId: string;
}

export interface TimeoutTurnResult {
  game: Game;
  /** この呼び出しで試合を終了させたか（false なら既に別の手・別の呼び出しで状態が進んでいた）。 */
  applied: boolean;
}

export async function timeoutTurn(input: TimeoutTurnInput): Promise<TimeoutTurnResult> {
  const game = await findGameById(input.gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  if (game.status !== "playing") {
    throw new ApplicationError("GAME_NOT_PLAYING", "試合中ではありません。");
  }
  if (!game.current_player_id || !game.turn_deadline_at) {
    throw new ApplicationError("GAME_NOT_PLAYING", "手番の締切が設定されていません。");
  }
  const now = new Date();
  if (new Date(game.turn_deadline_at).getTime() > now.getTime()) {
    throw new ApplicationError("VALIDATION_ERROR", "まだ制限時間を過ぎていません。");
  }

  const updated = await updateGameIfCurrent(
    input.gameId,
    { status: "playing", turnNo: game.turn_no, deadlineBefore: now.toISOString() },
    {
      status: "finished",
      currentPlayerId: null,
      turnDeadlineAt: null,
      loserId: game.current_player_id,
      finishReason: "timeout",
      finishedAt: now.toISOString(),
    },
  );
  if (!updated) {
    // 競合: 締切直前に手が確定した、または別のクライアントが先に timeout を確定させた。
    const latest = await findGameById(input.gameId);
    if (!latest) {
      throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
    }
    return { game: latest, applied: false };
  }
  await updateRoomStatus(updated.room_id, "waiting");
  return { game: updated, applied: true };
}
