import "server-only";

import type { Game } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { findGameById, updateGame } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { findVerifiedProblem } from "@/lib/server/repositories/problems";
import { updateRoomStatus } from "@/lib/server/repositories/rooms";
import { rollTurnDifficulty } from "@/lib/shared/difficulty";
import { getActivePlayers, MIN_PLAYERS } from "./turn-order";

// 担当: BE-A
// DB_DESIGN.md 5章-4: 試合開始（お題確定・先頭手番のセットアップ）
//
// - 参加人数が MIN_PLAYERS 未満なら開始できない（backend-todo 1-3）。
//   `game_players.is_ready` は「全員 ready で開始」を採用しないため参照しない（ホストの開始操作のみ）。
// - turnTimeLimitSeconds は games.turn_time_limit_seconds に保存し、2手目以降も同じ値を使う（1-4）。
// - お題確保中は status='generating' にし、失敗時は 'waiting' に戻す（1-8）。
// - turn_no は 1 から開始する（DB_DESIGN.md 5章-4 / mock と統一、1-9）。

export interface StartGameInput {
  gameId: string;
  turnTimeLimitSeconds: number;
}

/** 1手あたりの制限時間として許容する範囲（秒）。 */
export const TURN_TIME_LIMIT_RANGE = { min: 10, max: 600 } as const;

export async function startGame(input: StartGameInput): Promise<Game> {
  if (
    !Number.isInteger(input.turnTimeLimitSeconds) ||
    input.turnTimeLimitSeconds < TURN_TIME_LIMIT_RANGE.min ||
    input.turnTimeLimitSeconds > TURN_TIME_LIMIT_RANGE.max
  ) {
    throw new ApplicationError(
      "VALIDATION_ERROR",
      `制限時間は${TURN_TIME_LIMIT_RANGE.min}〜${TURN_TIME_LIMIT_RANGE.max}秒の整数で指定してください。`,
    );
  }
  const game = await findGameById(input.gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  if (game.status !== "waiting") {
    throw new ApplicationError("GAME_NOT_PLAYING", "この試合は開始可能な状態ではありません。");
  }

  const players = getActivePlayers(await listGamePlayers(input.gameId));
  if (players.length < MIN_PLAYERS) {
    throw new ApplicationError("VALIDATION_ERROR", `試合を開始するには${MIN_PLAYERS}人以上の参加者が必要です。`);
  }
  const firstPlayer = players[0];

  // お題確保中は 'generating' にして Realtime 経由で待機画面を出せるようにする。
  await updateGame(input.gameId, { status: "generating" });
  let problemId: string;
  let sourceCode: string;
  let initialLineCount: number;
  try {
    const problem = await findVerifiedProblem();
    if (!problem) {
      throw new ApplicationError("PROBLEM_GENERATION_FAILED", "利用可能な検証済みお題がありません。");
    }
    problemId = problem.id;
    sourceCode = problem.source_code;
    initialLineCount = problem.initial_line_count;
  } catch (error) {
    await updateGame(input.gameId, { status: "waiting" });
    throw error;
  }

  const startedAt = new Date();
  const updatedGame = await updateGame(input.gameId, {
    status: "playing",
    problemId,
    currentCode: sourceCode,
    currentLineCount: initialLineCount,
    currentPlayerId: firstPlayer.player_id,
    currentTurnDifficulty: rollTurnDifficulty(sourceCode),
    turnNo: 1,
    turnTimeLimitSeconds: input.turnTimeLimitSeconds,
    turnDeadlineAt: new Date(startedAt.getTime() + input.turnTimeLimitSeconds * 1000).toISOString(),
    startedAt: startedAt.toISOString(),
  });
  await updateRoomStatus(game.room_id, "playing");
  return updatedGame;
}
