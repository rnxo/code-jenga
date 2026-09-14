import "server-only";

import type { TestRun, TestRunKind, TestRunStatus } from "@/types/game";

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

export async function createTestRun(input: CreateTestRunInput): Promise<TestRun> {
  throw new Error(`未実装: createTestRun(${JSON.stringify(input)})`);
}
