import "server-only";

import type { Game } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { findGameById, updateGame } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { findVerifiedProblem } from "@/lib/server/repositories/problems";
import { updateRoomStatus } from "@/lib/server/repositories/rooms";
import { rollTurnDifficulty } from "@/lib/shared/difficulty";

// 担当: BE-A
// DB_DESIGN.md 5章-4: 試合開始（お題確定・先頭手番のセットアップ）

export interface StartGameInput {
  gameId: string;
  turnTimeLimitSeconds: number;
}

export async function startGame(input: StartGameInput): Promise<Game> {
  if (!Number.isInteger(input.turnTimeLimitSeconds) || input.turnTimeLimitSeconds <= 0) {
    throw new ApplicationError("VALIDATION_ERROR", "制限時間は1秒以上の整数で指定してください。");
  }
  const game = await findGameById(input.gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  if (game.status !== "waiting") {
    throw new ApplicationError("GAME_NOT_PLAYING", "この試合は開始可能な状態ではありません。");
  }
  const problem = await findVerifiedProblem();
  if (!problem) {
    throw new ApplicationError("PROBLEM_GENERATION_FAILED", "利用可能な検証済みお題がありません。");
  }
  const players = await listGamePlayers(input.gameId);
  const firstPlayer = players
    .filter((player) => player.left_at === null)
    .sort((first, second) => first.turn_order - second.turn_order)[0];
  if (!firstPlayer) {
    throw new ApplicationError("GAME_NOT_PLAYING", "手番を設定できる参加者がいません。");
  }
  const startedAt = new Date();
  const updatedGame = await updateGame(input.gameId, {
    status: "playing",
    problemId: problem.id,
    currentCode: problem.source_code,
    currentLineCount: problem.initial_line_count,
    currentPlayerId: firstPlayer.player_id,
    currentTurnDifficulty: rollTurnDifficulty(problem.source_code),
    turnNo: 0,
    turnDeadlineAt: new Date(startedAt.getTime() + input.turnTimeLimitSeconds * 1000).toISOString(),
    startedAt: startedAt.toISOString(),
  });
  await updateRoomStatus(game.room_id, "playing");
  return updatedGame;
}
