import "server-only";

import { createTestRun } from "@/lib/server/repositories/test-runs";
import { markProblemVerified } from "@/lib/server/repositories/problems";
import { PistonError } from "./errors";
import { parseVitestOutput, type VitestSummary } from "./parse-vitest";
import { runOnPiston } from "./run";
import { computeSafeLines } from "./safe-lines";

// 担当: BE-B
// DB_DESIGN.md 5章-2: お題の事前検証。削除前の状態で全テストが通ることを Piston で確認し、
// test_runs（kind='problem_verification'）に記録してから problems.is_verified = true にする。
// これを経ずにゲームへ使うと、最初の1手を待たずに理不尽なアウトが発生しうる。
//
// さらに 1 行ずつ削除して Piston で実行し、「削除しても全テストが通る行（セーフ行）」を算出して
// problems.safe_line_texts に保存する。空行を除いたセーフ行が MIN_SAFE_LINES 未満のお題は
// どの行を消してもアウトになりゲームとして成立しないため、検証失敗として扱う。

export interface VerifyProblemInput {
  problemId: string;
  sourceCode: string;
  testCode: string;
  language: string;
}

export interface VerifyProblemResult {
  verified: boolean;
  testRunId: string | null;
  summary: VitestSummary | null;
  /** 未検証の理由（握りつぶさない）。 */
  reason: string | null;
  /** 算出したセーフ行（検証成功時のみ。失敗時は null）。 */
  safeLineTexts: string[] | null;
  /** 空行を除いたセーフ行の数（セーフ行を算出できた場合のみ）。 */
  safeLineCount: number | null;
}

/** ゲームとして成立するために必要な、空行を除いたセーフ行の最低数。 */
export const MIN_SAFE_LINES = 3;

export async function verifyProblem(input: VerifyProblemInput): Promise<VerifyProblemResult> {
  const startedAt = Date.now();
  const concatenated = `${input.sourceCode}\n\n${input.testCode}`;

  let result;
  try {
    result = await runOnPiston({
      language: input.language,
      languageVersion: "*",
      code: concatenated,
      sourceCode: input.sourceCode,
      testCode: input.testCode,
    });
  } catch (error) {
    const message =
      error instanceof PistonError
        ? error.message
        : error instanceof Error
          ? `お題の検証に失敗しました: ${error.message}`
          : "お題の検証に失敗しました。";
    const testRun = await createTestRun({
      kind: "problem_verification",
      problemId: input.problemId,
      language: input.language,
      languageVersion: "*",
      executedCode: concatenated,
      status: "error",
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    });
    return {
      verified: false,
      testRunId: testRun.id,
      summary: null,
      reason: message,
      safeLineTexts: null,
      safeLineCount: null,
    };
  }

  const summary = parseVitestOutput(result.stdout);
  const status = result.outcome;
  const testRun = await createTestRun({
    kind: "problem_verification",
    problemId: input.problemId,
    language: result.resolvedLanguage,
    languageVersion: result.resolvedVersion,
    executedCode: result.executedCode,
    status,
    exitCode: result.exitCode ?? undefined,
    stdout: result.stdout,
    stderr: result.stderr,
    compileOutput: result.compileOutput ?? undefined,
    totalTests: summary?.totalTests,
    passedTests: summary?.passedTests,
    failedTests: summary?.failedTests,
    durationMs: Date.now() - startedAt,
    pistonRaw: result.raw,
    errorMessage: result.errorMessage ?? undefined,
  });

  // テスト0件でも exit 0 になりうるため、totalTests > 0 を必ず要求する。
  const passedBeforeDeletion =
    status === "passed" && summary !== null && summary.totalTests > 0 && summary.failedTests === 0;
  if (!passedBeforeDeletion) {
    const reason =
      status === "error"
        ? (result.errorMessage ?? "テスト結果を判定できませんでした。")
        : summary === null
          ? "テスト結果のサマリを読み取れませんでした。"
          : summary.totalTests === 0
            ? "テストが1件も含まれていません。"
            : `削除前の状態でテストが失敗しています（${summary.failedTests}/${summary.totalTests} 件失敗）。${result.stderr.slice(0, 200)}`;
    return { verified: false, testRunId: testRun.id, summary, reason, safeLineTexts: null, safeLineCount: null };
  }

  // 削除前は通る。次に 1 行ずつ削除してセーフ行を算出し、ゲームとして成立するかを確認する。
  let safeLines;
  try {
    safeLines = await computeSafeLines({
      sourceCode: input.sourceCode,
      testCode: input.testCode,
      language: input.language,
    });
  } catch (error) {
    const message = `セーフ行の算出に失敗しました: ${error instanceof Error ? error.message : "原因不明のエラー"}`;
    return { verified: false, testRunId: testRun.id, summary, reason: message, safeLineTexts: null, safeLineCount: null };
  }

  if (safeLines.nonBlankSafeLineCount < MIN_SAFE_LINES) {
    return {
      verified: false,
      testRunId: testRun.id,
      summary,
      reason: `削除しても通る行が ${safeLines.nonBlankSafeLineCount} 行しかなくゲームとして成立しません（最低 ${MIN_SAFE_LINES} 行）。`,
      safeLineTexts: null,
      safeLineCount: safeLines.nonBlankSafeLineCount,
    };
  }

  await markProblemVerified(input.problemId, safeLines.safeLineTexts);
  return {
    verified: true,
    testRunId: testRun.id,
    summary,
    reason: null,
    safeLineTexts: safeLines.safeLineTexts,
    safeLineCount: safeLines.nonBlankSafeLineCount,
  };
}
