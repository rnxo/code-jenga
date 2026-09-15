import "server-only";

import type { Game, GamePlayer } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { findGameById, updateGameIfCurrent } from "@/lib/server/repositories/games";
import { listGamePlayers, markGamePlayerLeft } from "@/lib/server/repositories/game-players";
import { findProblemById } from "@/lib/server/repositories/problems";
import { findRoomById, transferRoomHost, updateRoomStatus } from "@/lib/server/repositories/rooms";
import { rollTurnDifficulty } from "@/lib/shared/difficulty";
import { getActivePlayers, getNextHostIdAfterLeave, getNextPlayerIdAfterLeave, MIN_PLAYERS } from "./turn-order";

// 担当: BE-A
// backend-todo 1-7: 離脱・中断の処理。
//
// - game_players.left_at をセットする（以降 getNextPlayerId がその参加者を飛ばす）。
// - 試合中に手番プレイヤーが離脱したら次のプレイヤーへ手番を回し、締切を再セットする。
// - 残りが MIN_PLAYERS 未満になったら status='aborted' / finish_reason='aborted' で中断する。
// - 待機中（waiting）は left_at をセットするだけ。全員が離脱したらルームを 'closed' にする。
// - ホスト（rooms.host_id）が離脱したら、残っている参加者のうち一番早く入室した人へホスト権限を移す。
//   試合中・決着後を問わず行う（決着後に再戦ロビーを開始できる人がいなくなるのを防ぐため）。

export interface LeaveGameInput {
  gameId: string;
  playerId: string;
}

export interface LeaveGameResult {
  game: Game;
}

export async function leaveGame(input: LeaveGameInput): Promise<LeaveGameResult> {
  const game = await findGameById(input.gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  const playersBefore = await listGamePlayers(input.gameId);
  if (!playersBefore.some((player) => player.player_id === input.playerId)) {
    throw new ApplicationError("UNAUTHENTICATED", "この試合の参加者ではありません。");
  }
  if (game.status === "finished" || game.status === "aborted") {
    // 決着後の離脱は記録だけ残す（退出済みの参加者は再戦を申し出られない）。
    const leftAfterFinish = await markGamePlayerLeft(input.gameId, input.playerId);
    if (leftAfterFinish) {
      await transferHostIfLeaving(game.room_id, input.playerId, await listGamePlayers(input.gameId));
    }
    return { game };
  }

  const left = await markGamePlayerLeft(input.gameId, input.playerId);
  if (!left) {
    throw new ApplicationError("VALIDATION_ERROR", "既にこの試合から離脱しています。");
  }
  const players = await listGamePlayers(input.gameId);
  const activePlayers = getActivePlayers(players);
  await transferHostIfLeaving(game.room_id, input.playerId, players);

  if (game.status === "waiting" || game.status === "generating") {
    if (activePlayers.length === 0) {
      await updateRoomStatus(game.room_id, "closed");
    }
    return { game };
  }

  // status === 'playing'
  if (activePlayers.length < MIN_PLAYERS) {
    const now = new Date().toISOString();
    const aborted = await updateGameIfCurrent(
      input.gameId,
      { status: "playing", turnNo: game.turn_no },
      {
        status: "aborted",
        currentPlayerId: null,
        turnDeadlineAt: null,
        finishReason: "aborted",
        finishedAt: now,
      },
    );
    if (aborted) {
      await updateRoomStatus(aborted.room_id, "waiting");
      return { game: aborted };
    }
    return { game: await requireGame(input.gameId) };
  }

  if (game.current_player_id !== input.playerId || !game.current_code) {
    // 手番でないプレイヤーの離脱は left_at のセットだけで十分。
    return { game };
  }

  // 手番中の離脱: 次のプレイヤーへ回し、締切と難易度を引き直す（コードは変わらないので turn_no は据え置く）。
  const nextPlayerId = getNextPlayerIdAfterLeave(players, input.playerId);
  // 難易度の引き直しにはお題のセーフ行が要る。取れなければ従来通り削除可能行だけで抽選する（警告は残す）。
  const problem = game.problem_id ? await findProblemById(game.problem_id) : null;
  if (!problem) {
    console.warn(`[leave-game] お題が取得できないためセーフ行なしで難易度を抽選します（game=${input.gameId}）`);
  }
  const passed = await updateGameIfCurrent(
    input.gameId,
    { status: "playing", turnNo: game.turn_no },
    {
      currentPlayerId: nextPlayerId,
      currentTurnDifficulty: rollTurnDifficulty(
        game.current_code,
        Math.random,
        game.language,
        problem?.safe_line_texts ?? null,
      ),
      turnDeadlineAt: new Date(Date.now() + game.turn_time_limit_seconds * 1000).toISOString(),
    },
  );
  return { game: passed ?? (await requireGame(input.gameId)) };
}

/**
 * 離脱者がホストなら、残っている参加者へホスト権限を移す。
 * 残りがいなければ何もしない（ルームは呼び出し側で closed にするか、そのまま空になる）。
 * 委譲に失敗しても離脱自体は成立させたいので、ここでは例外を投げずに警告ログだけ残す。
 */
async function transferHostIfLeaving(roomId: string, leftPlayerId: string, players: GamePlayer[]): Promise<void> {
  const room = await findRoomById(roomId);
  if (!room) {
    console.warn(`[leave-game] ルームが見つからないためホスト委譲を行いません（room=${roomId}）`);
    return;
  }
  if (room.host_id !== leftPlayerId) {
    return;
  }
  const nextHostId = getNextHostIdAfterLeave(players, leftPlayerId);
  if (!nextHostId) {
    return;
  }
  const transferred = await transferRoomHost(roomId, leftPlayerId, nextHostId);
  if (!transferred) {
    console.warn(`[leave-game] ホストが既に変わっていたため委譲をスキップしました（room=${roomId}）`);
  }
}

async function requireGame(gameId: string): Promise<Game> {
  const game = await findGameById(gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  return game;
}
