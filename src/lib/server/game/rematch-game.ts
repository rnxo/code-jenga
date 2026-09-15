import "server-only";

import type { Game, GamePlayer } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { createGame, findGameById, findLatestGameByRoomId } from "@/lib/server/repositories/games";
import { copyGamePlayers, listGamePlayers } from "@/lib/server/repositories/game-players";
import { updateRoomStatus } from "@/lib/server/repositories/rooms";

// 担当: BE-A
// backend-todo 1-6 / DB_DESIGN.md 5章-6: 再戦フロー。
// 決着した games(round_no = n) から games(round_no = n + 1, status='waiting') を作り、
// 前局の現役参加者をコピーして rooms.status を 'waiting' に戻す。
// 同じ前局に対して複数回呼ばれても、既に次局が作られていればそれを返す（冪等）。

export interface RematchGameInput {
  /** 決着済みの前局の games.id */
  gameId: string;
}

export interface RematchGameResult {
  game: Game;
  players: GamePlayer[];
}

export async function rematchGame(input: RematchGameInput): Promise<RematchGameResult> {
  const previous = await findGameById(input.gameId);
  if (!previous) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  if (previous.status !== "finished" && previous.status !== "aborted") {
    throw new ApplicationError("GAME_NOT_PLAYING", "決着していない試合は再戦できません。");
  }

  const latest = await findLatestGameByRoomId(previous.room_id);
  if (latest && latest.round_no > previous.round_no) {
    if (latest.status !== "waiting") {
      throw new ApplicationError("GAME_NOT_PLAYING", "このルームでは既に次の試合が進行中です。");
    }
    // 既に再戦用の games 行が作られている（別の参加者が先に呼んだ）。
    return { game: latest, players: await listGamePlayers(latest.id) };
  }

  // 前局の言語を引き継ぐ（新しいロビーでホストが変更することはできる）。
  const next = await createGame({
    roomId: previous.room_id,
    roundNo: previous.round_no + 1,
    language: previous.language,
  });
  const players = await copyGamePlayers(previous.id, next.id);
  await updateRoomStatus(previous.room_id, "waiting");
  return { game: next, players };
}
