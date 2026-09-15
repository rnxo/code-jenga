import "server-only";

import type { Game, GamePlayer } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { createGame, findGameById, findLatestGameByRoomId } from "@/lib/server/repositories/games";
import { addGamePlayer, listGamePlayers } from "@/lib/server/repositories/game-players";
import { updateRoomStatus } from "@/lib/server/repositories/rooms";

// 担当: BE-A
// backend-todo 1-6 / DB_DESIGN.md 5章-6: 再戦フロー。
// 決着した games(round_no = n) から games(round_no = n + 1, status='waiting') を作り、
// 「再戦する」を押した参加者だけを次局に登録して rooms.status を 'waiting' に戻す。
// 前局の参加者全員をまとめてコピーはしない（押していない人をロビーへ引きずり込まないため）。
// 同じ前局に対して何度呼ばれても、次局は 1 つだけ作られ、同じ人は二重登録されない（冪等）。

export interface RematchGameInput {
  /** 決着済みの前局の games.id */
  gameId: string;
  /** 再戦を申し出た参加者（前局の現役参加者であること） */
  playerId: string;
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

  const previousPlayers = await listGamePlayers(previous.id);
  const self = previousPlayers.find((player) => player.player_id === input.playerId);
  if (!self) {
    throw new ApplicationError("FORBIDDEN", "この試合の参加者ではありません。");
  }
  if (self.left_at !== null) {
    throw new ApplicationError("FORBIDDEN", "退出した試合には再戦できません。");
  }

  const next = await findOrCreateNextGame(previous);
  const players = await listGamePlayers(next.id);
  if (players.some((player) => player.player_id === input.playerId)) {
    // 既に次局へ登録済み（二重クリックや再読み込み）。
    return { game: next, players };
  }

  const added = await addGamePlayer({
    gameId: next.id,
    playerId: input.playerId,
    turnOrder: players.length,
  });
  return { game: next, players: [...players, added] };
}

/** 次局（round_no + 1, waiting）を返す。無ければ作る。同時に押されても 1 つに収束させる。 */
async function findOrCreateNextGame(previous: Game): Promise<Game> {
  const latest = await findLatestGameByRoomId(previous.room_id);
  if (latest && latest.round_no > previous.round_no) {
    if (latest.status !== "waiting") {
      throw new ApplicationError("GAME_NOT_PLAYING", "このルームでは既に次の試合が進行中です。");
    }
    return latest;
  }

  try {
    // 前局の言語を引き継ぐ（新しいロビーでホストが変更することはできる）。
    const created = await createGame({
      roomId: previous.room_id,
      roundNo: previous.round_no + 1,
      language: previous.language,
    });
    await updateRoomStatus(previous.room_id, "waiting");
    return created;
  } catch (error) {
    // unique (room_id, round_no) に弾かれた = 別の参加者が同時に作った。作られた方を使う。
    const racedLatest = await findLatestGameByRoomId(previous.room_id);
    if (racedLatest && racedLatest.round_no === previous.round_no + 1 && racedLatest.status === "waiting") {
      return racedLatest;
    }
    throw error;
  }
}
