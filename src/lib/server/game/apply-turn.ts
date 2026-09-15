import "server-only";

import { ApplicationError } from "@/lib/api/errors";
import type { ApiErrorCode } from "@/types/api";
import { deleteLine } from "@/lib/shared/code";
import type { Game, Turn } from "@/types/game";
import { applyTurnTransaction, findGameById, GameRpcError } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { getNextPlayerId } from "./turn-order";
import { judgeTurnResult } from "./judge";
import { runOnPiston } from "@/lib/server/piston/run";
import { parseVitestOutput } from "@/lib/server/piston/parse-vitest";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder, rollTurnDifficulty } from "@/lib/shared/difficulty";

// 担当: BE-A
// DB_DESIGN.md 5章-5: 1手の確定（この関数が全体の中核）。
// Piston 実行はこの関数内で行い、DB への書き込み（test_runs / turns / games / rooms）は
// apply_turn RPC に委譲して1トランザクションで確定する（backend-todo 1-2）。

export interface ApplyTurnInput {
  gameId: string;
  playerId: string;
  lineNo: number;
}

export interface ApplyTurnResult {
  turn: Turn;
  game: Game;
}

/** RPC が raise したコードのうち API エラーとして返せるもの。 */
const RPC_CODE_TO_API_CODE: Partial<Record<string, ApiErrorCode>> = {
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_NOT_PLAYING: "GAME_NOT_PLAYING",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
};

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
  const judgement = judgeTurnResult(testStatus);
  if (!judgement.judged) {
    // Piston 自体の失敗（判定不能）は DB に残さず、同じ手を再送できるようにする（backend-todo 4-4）。
    throw new ApplicationError("TEST_RUN_ERROR", judgement.reason);
  }

  const players = await listGamePlayers(input.gameId);
  const isOut = judgement.result === "out";
  const noLinesLeft = deletedLine.codeAfter.length === 0;
  const isFinished = isOut || noLinesLeft;
  const nextPlayerId = isFinished ? null : getNextPlayerId(players, input.playerId);

  try {
    return await applyTurnTransaction({
      gameId: input.gameId,
      playerId: input.playerId,
      expectedTurnNo: game.turn_no,
      deletedLineNo: input.lineNo,
      deletedLineText: deletedLine.deletedLineText,
      codeAfter: deletedLine.codeAfter,
      turnResult: judgement.result,
      nextPlayerId,
      nextTurnDifficulty: isFinished ? null : rollTurnDifficulty(deletedLine.codeAfter),
      finishReason: isOut ? "test_failed" : noLinesLeft ? "no_lines_left" : null,
      durationMs: Date.now() - startedAt,
      testRun: {
        language: pistonResult.resolvedLanguage,
        languageVersion: pistonResult.resolvedVersion,
        executedCode: pistonResult.executedCode,
        status: testStatus,
        exitCode: pistonResult.exitCode,
        stdout: pistonResult.stdout,
        stderr: pistonResult.stderr,
        compileOutput: pistonResult.compileOutput ?? null,
        totalTests: summary?.totalTests ?? null,
        passedTests: summary?.passedTests ?? null,
        failedTests: summary?.failedTests ?? null,
        durationMs: Date.now() - startedAt,
        pistonRaw: pistonResult.raw,
        errorMessage: pistonResult.errorMessage ?? null,
      },
    });
  } catch (error) {
    if (error instanceof GameRpcError) {
      const apiCode = RPC_CODE_TO_API_CODE[error.rpcCode];
      if (apiCode) {
        throw new ApplicationError(apiCode, error.message);
      }
    }
    throw error;
  }
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
