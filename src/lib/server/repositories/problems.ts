import "server-only";

import type { Problem, ProblemSource } from "@/types/game";

// problems テーブルへのアクセスをまとめるリポジトリ。担当: BE-A（BE-B の gemini/piston 実装から呼ばれる）

export interface CreateProblemInput {
  sourceCode: string;
  testCode: string;
  language: string;
  initialLineCount: number;
  generatedBy: ProblemSource;
  generationPrompt?: string;
  difficulty?: string;
}

export async function createProblem(input: CreateProblemInput): Promise<Problem> {
  throw new Error(`未実装: createProblem(${JSON.stringify(input)})`);
}

export async function markProblemVerified(problemId: string): Promise<void> {
  throw new Error(`未実装: markProblemVerified(${problemId})`);
}

/** is_verified = true の使用可能なお題を1件取得する（DB_DESIGN.md 4.2 の部分インデックス対象）。 */
export async function findVerifiedProblem(): Promise<Problem | null> {
  throw new Error("未実装: findVerifiedProblem()");
}
