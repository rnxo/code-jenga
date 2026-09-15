import "server-only";

import { ApplicationError } from "@/lib/api/errors";
import { deleteLine } from "@/lib/shared/code";
import type { Game, Turn } from "@/types/game";
import { findGameById, updateGame } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { createTestRun } from "@/lib/server/repositories/test-runs";
import { createTurn } from "@/lib/server/repositories/turns";
import { getNextPlayerId } from "./turn-order";
import { judgeTurnResult } from "./judge";
import { runOnPiston } from "@/lib/server/piston/run";
import { parseVitestOutput } from "@/lib/server/piston/parse-vitest";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder, rollTurnDifficulty } from "@/lib/shared/difficulty";

// 担当: BE-A
// DB_DESIGN.md 5章-5: 1手の確定（この関数が全体の中核）。

export interface ApplyTurnInput {
  gameId: string;
  playerId: string;
  lineNo: number;
}

export interface ApplyTurnResult {
  turn: Turn;
  game: Game;
}

// 1手の確定処理を行う。
// 1. 該当ゲームの状態を取得し、手番・難易度・コード状態を検証する。
// 2. 指定行を削除し、難易度ルールに従って削除可能か判定する。
export async function applyTurn(input: ApplyTurnInput): Promise<ApplyTurnResult> {
  const game = await findGameById(input.gameId);
  if (!game) {
    throw new ApplicationError("GAME_NOT_FOUND", "試合が見つかりません。");
  }
  if (game.status !== "playing") {
    throw new ApplicationError("GAME_NOT_PLAYING", "試合中ではありません。");
  }
  if (game.current_player_id !== input.playerId) {
    throw new ApplicationError("NOT_YOUR_TURN", "現在の手番ではありません。");
  }
  if (!game.current_code || !game.problem_id || !game.current_player_id || !game.current_turn_difficulty) {
    throw new ApplicationError("GAME_NOT_PLAYING", "試合のコード状態が不正です。");
  }
  const currentDifficulty = game.current_turn_difficulty;

  let deletedLine: { codeAfter: string; deletedLineText: string };
  try {
    deletedLine = deleteLine(game.current_code, input.lineNo);
  } catch (error) {
    throw new ApplicationError("INVALID_LINE", error instanceof Error ? error.message : "削除行が不正です。");
  }

  if (!isDeletableUnder(currentDifficulty, deletedLine.deletedLineText)) {
    throw new ApplicationError(
      "LINE_NOT_DELETABLE",
      `現在の難易度「${DIFFICULTY_LABEL[currentDifficulty]}」ではこの行を削除できません。${DIFFICULTY_RULE_TEXT[currentDifficulty]}`,
    );
  }

  const startedAt = Date.now();
  const problem = await loadProblem(game.problem_id);
  let pistonResult;
  try {
    pistonResult = await runOnPiston({
      language: problem.language,
      languageVersion: "latest",
      code: `${deletedLine.codeAfter}\n\n${problem.test_code}`,
      sourceCode: deletedLine.codeAfter,
      testCode: problem.test_code,
    });
  } catch (error) {
    throw new ApplicationError(
      "TEST_RUN_ERROR",
      error instanceof Error ? `テスト実行に失敗しました: ${error.message}` : "テスト実行に失敗しました。",
    );
  }

  const summary = parseVitestOutput(pistonResult.stdout);
  const testStatus = pistonResult.exitCode === null ? "error" : pistonResult.exitCode === 0 ? "passed" : "failed";
  const testRun = await createTestRun({
    kind: "turn_check",
    gameId: input.gameId,
    language: pistonResult.resolvedLanguage,
    languageVersion: pistonResult.resolvedVersion,
    executedCode: pistonResult.executedCode,
    status: testStatus,
    exitCode: pistonResult.exitCode ?? undefined,
    stdout: pistonResult.stdout,
    stderr: pistonResult.stderr,
    compileOutput: pistonResult.compileOutput ?? undefined,
    totalTests: summary?.totalTests,
    passedTests: summary?.passedTests,
    failedTests: summary?.failedTests,
    durationMs: Date.now() - startedAt,
    pistonRaw: pistonResult.raw,
    errorMessage: pistonResult.errorMessage ?? undefined,
  });
  const judgement = judgeTurnResult(testRun.status);
  if (!judgement.judged) {
    throw new ApplicationError("TEST_RUN_ERROR", judgement.reason);
  }

  const players = await listGamePlayers(input.gameId);
  const isFinished = judgement.result === "out" || deletedLine.codeAfter.length === 0;
  const nextPlayerId = isFinished ? null : getNextPlayerId(players, input.playerId);
  const turn = await createTurn({
    gameId: input.gameId,
    turnNo: game.turn_no + 1,
    playerId: input.playerId,
    deletedLineNo: input.lineNo,
    deletedLineText: deletedLine.deletedLineText,
    codeBefore: game.current_code,
    codeAfter: deletedLine.codeAfter,
    turnDifficulty: currentDifficulty,
    result: judgement.result,
    testRunId: testRun.id,
    durationMs: Date.now() - startedAt,
  });
  const updatedGame = await updateGame(input.gameId, {
    status: isFinished ? "finished" : "playing",
    currentCode: deletedLine.codeAfter,
    currentLineCount: deletedLine.codeAfter === "" ? 0 : deletedLine.codeAfter.split("\n").length,
    currentPlayerId: nextPlayerId,
    currentTurnDifficulty: isFinished ? null : rollTurnDifficulty(deletedLine.codeAfter),
    turnNo: game.turn_no + 1,
    turnDeadlineAt: nextPlayerId ? new Date(Date.now() + game.turn_time_limit_seconds * 1000).toISOString() : null,
    loserId: judgement.result === "out" ? input.playerId : null,
    finishReason: judgement.result === "out" ? "test_failed" : deletedLine.codeAfter.length === 0 ? "no_lines_left" : null,
    finishedAt: isFinished ? new Date().toISOString() : undefined,
  });
  return { turn, game: updatedGame };
}

/** お題IDから現在のお題を取得する。 */
async function loadProblem(problemId: string) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data, error } = await createAdminClient().from("problems").select().eq("id", problemId).single();
  if (error || !data) {
    throw new Error(`お題の取得に失敗しました: ${error?.message ?? "見つかりません"}`);
  }
  return data;
}
