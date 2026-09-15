import "server-only";

import { ApplicationError } from "@/lib/api/errors";
import type { ApiErrorCode } from "@/types/api";
import { deleteLine } from "@/lib/shared/code";
import type { Game, Turn } from "@/types/game";
import { applyTurnTransaction, findGameById, GameRpcError } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { findProblemById } from "@/lib/server/repositories/problems";
import { PistonError } from "@/lib/server/piston/errors";
import { getNextPlayerId } from "./turn-order";
import { judgeTurnResult } from "./judge";
import { runOnPiston } from "@/lib/server/piston/run";
import { parseVitestOutput } from "@/lib/server/piston/parse-vitest";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder, rollTurnDifficulty } from "@/lib/shared/difficulty";
import { toCodeLanguage } from "@/lib/shared/language";

// 担当: BE-A
// DB_DESIGN.md 5章-5: 1手の確定（この関数が全体の中核）。
// Piston 実行はこの関数内で行い、DB への書き込み（test_runs / turns / games / rooms）は
// apply_turn RPC に委譲して1トランザクションで確定する（backend-todo 1-2）。
//
// TEST_RUN_ERROR（Piston 呼び出し自体の失敗・判定不能）の救済方針（backend-todo 4-4）:
// - 一過性の失敗は run.ts が総予算の範囲内で自動リトライする。それでも失敗した場合のみここに届く。
// - この場合は turns / test_runs / games に何も書かず、手番もそのまま。クライアントは 502 を受け取り、
//   同じ行番号で POST /api/games/[gameId]/turns を再送すれば良い（べき等）。
// - 判定不能をアウト扱いにはしない（judge.ts）。メッセージで「再送できる」ことをプレイヤーに伝える。

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

// 1手の確定処理を行う。
// 1. 該当ゲームの状態を取得し、手番・難易度・コード状態を検証する。
// 2. 指定行を削除し、難易度ルールに従って削除可能か判定する。
// 3. Piston でテストを実行し、結果を apply_turn RPC で1トランザクション確定する。
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

  // 難易度の行判定は言語ごとにコメント記法・キーワードが違うため、お題の言語で判定する。
  const problemForRules = await findProblemById(game.problem_id);
  if (!problemForRules) {
    throw new ApplicationError("INTERNAL_ERROR", `試合に紐づくお題が見つかりません（problem_id=${game.problem_id}）。`);
  }
  const language = toCodeLanguage(problemForRules.language);

  let deletedLine: { codeAfter: string; deletedLineText: string };
  try {
    deletedLine = deleteLine(game.current_code, input.lineNo);
  } catch (error) {
    throw new ApplicationError("INVALID_LINE", error instanceof Error ? error.message : "削除行が不正です。");
  }

  if (!isDeletableUnder(currentDifficulty, deletedLine.deletedLineText, language)) {
    throw new ApplicationError(
      "LINE_NOT_DELETABLE",
      `現在の難易度「${DIFFICULTY_LABEL[currentDifficulty]}」ではこの行を削除できません。${DIFFICULTY_RULE_TEXT[currentDifficulty]}`,
    );
  }

  const startedAt = Date.now();
  const problem = problemForRules;
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
    throw toTestRunError(input, error);
  }

  const summary = parseVitestOutput(pistonResult.stdout);
  const testStatus = pistonResult.outcome;
  const judgement = judgeTurnResult(testStatus);
  if (!judgement.judged) {
    // 判定不能（ハーネス障害など）は DB に残さず、同じ手を再送できるようにする（backend-todo 4-4）。
    throw toTestRunError(input, new Error(pistonResult.errorMessage ?? judgement.reason));
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
      nextTurnDifficulty: isFinished
        ? null
        : rollTurnDifficulty(deletedLine.codeAfter, Math.random, language, problemForRules.safe_line_texts),
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

const RETRY_HINT = "手番は消費されていません。しばらく待ってから同じ行をもう一度送信してください。";

/**
 * Piston 呼び出しの失敗・判定不能を TEST_RUN_ERROR に変換する（backend-todo 4-4）。
 * ターンは確定していないので、メッセージで再送可能であることを伝え、原因はサーバーログに残す。
 */
function toTestRunError(input: ApplyTurnInput, error: unknown): ApplicationError {
  const detail = error instanceof Error ? error.message : "原因不明のエラー";
  const kind = error instanceof PistonError ? error.kind : "unjudgeable";
  console.error(
    `[apply-turn] TEST_RUN_ERROR kind=${kind} game=${input.gameId} player=${input.playerId} line=${input.lineNo}: ${detail}`,
  );
  return new ApplicationError("TEST_RUN_ERROR", `テスト実行に失敗しました（${detail}）。${RETRY_HINT}`);
}
