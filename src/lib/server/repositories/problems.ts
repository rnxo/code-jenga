import "server-only";

import type { Problem, ProblemSource } from "@/types/game";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** 生成されたお題を未検証状態で保存する。 */
export async function createProblem(input: CreateProblemInput): Promise<Problem> {
  const { data, error } = await createAdminClient()
    .from("problems")
    .insert({
      source_code: input.sourceCode,
      test_code: input.testCode,
      language: input.language,
      initial_line_count: input.initialLineCount,
      generated_by: input.generatedBy,
      generation_prompt: input.generationPrompt,
      difficulty: input.difficulty,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`お題の保存に失敗しました: ${error.message}`);
  }
  return data;
}

/** お題を検証済みとして更新する。 */
export async function markProblemVerified(problemId: string): Promise<void> {
  const { error } = await createAdminClient().from("problems").update({ is_verified: true }).eq("id", problemId);
  if (error) {
    throw new Error(`お題の検証状態更新に失敗しました: ${error.message}`);
  }
}

/** is_verified = true の使用可能なお題を1件取得する（DB_DESIGN.md 4.2 の部分インデックス対象）。 */
export async function findVerifiedProblem(): Promise<Problem | null> {
  const { data, error } = await createAdminClient()
    .from("problems")
    .select()
    .eq("is_verified", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`検証済みお題の取得に失敗しました: ${error.message}`);
  }
  return data;
}
