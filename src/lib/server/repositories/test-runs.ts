import "server-only";

import type { TestRun, TestRunKind, TestRunStatus } from "@/types/game";
import { createAdminClient } from "@/lib/supabase/admin";

// test_runs テーブルへのアクセスをまとめるリポジトリ。担当: BE-A
// kind = 'problem_verification' | 'turn_check' の両方をこの1テーブルで扱う（DB_DESIGN.md 4.6）。

export interface CreateTestRunInput {
  kind: TestRunKind;
  problemId?: string;
  gameId?: string;
  language: string;
  languageVersion: string;
  executedCode: string;
  status: TestRunStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  durationMs?: number;
  pistonRaw?: unknown;
  errorMessage?: string;
}

/** テスト実行結果を保存する。 */
export async function createTestRun(input: CreateTestRunInput): Promise<TestRun> {
  const { data, error } = await createAdminClient()
    .from("test_runs")
    .insert({
      kind: input.kind,
      problem_id: input.problemId,
      game_id: input.gameId,
      language: input.language,
      language_version: input.languageVersion,
      executed_code: input.executedCode,
      status: input.status,
      exit_code: input.exitCode,
      stdout: input.stdout,
      stderr: input.stderr,
      compile_output: input.compileOutput,
      total_tests: input.totalTests,
      passed_tests: input.passedTests,
      failed_tests: input.failedTests,
      duration_ms: input.durationMs,
      piston_raw: input.pistonRaw as never,
      error_message: input.errorMessage,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`テスト実行結果の保存に失敗しました: ${error.message}`);
  }
  return data;
}
