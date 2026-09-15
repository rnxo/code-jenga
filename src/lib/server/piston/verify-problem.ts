import "server-only";

import { createTestRun } from "@/lib/server/repositories/test-runs";
import { markProblemVerified } from "@/lib/server/repositories/problems";
import { PistonError } from "./errors";
import { parseVitestOutput, type VitestSummary } from "./parse-vitest";
import { runOnPiston } from "./run";

// 担当: BE-B
// DB_DESIGN.md 5章-2: お題の事前検証。削除前の状態で全テストが通ることを Piston で確認し、
// test_runs（kind='problem_verification'）に記録してから problems.is_verified = true にする。
// これを経ずにゲームへ使うと、最初の1手を待たずに理不尽なアウトが発生しうる。

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
}

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
    return { verified: false, testRunId: testRun.id, summary: null, reason: message };
  }

  const summary = parseVitestOutput(result.stdout);
  const status = result.exitCode === null ? "error" : result.exitCode === 0 ? "passed" : "failed";
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
  const verified = status === "passed" && summary !== null && summary.totalTests > 0 && summary.failedTests === 0;
  if (verified) {
    await markProblemVerified(input.problemId);
    return { verified: true, testRunId: testRun.id, summary, reason: null };
  }

  const reason =
    status === "error"
      ? (result.errorMessage ?? "テスト結果を判定できませんでした。")
      : summary === null
        ? "テスト結果のサマリを読み取れませんでした。"
        : summary.totalTests === 0
          ? "テストが1件も含まれていません。"
          : `削除前の状態でテストが失敗しています（${summary.failedTests}/${summary.totalTests} 件失敗）。${result.stderr.slice(0, 200)}`;
  return { verified: false, testRunId: testRun.id, summary, reason };
}
