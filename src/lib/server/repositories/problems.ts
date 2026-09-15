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

export interface FindVerifiedProblemOptions {
  generatedBy?: ProblemSource;
  roomId?: string;
  difficulty?: string;
}

/** 条件に合う検証済みお題から、同一ルームの直近使用分を除外してランダムに1件取得する。 */
export async function findVerifiedProblem(options: FindVerifiedProblemOptions = {}): Promise<Problem | null> {
  let query = createAdminClient()
    .from("problems")
    .select()
    .eq("is_verified", true)
    .order("created_at", { ascending: true });
  if (options.generatedBy) {
    query = query.eq("generated_by", options.generatedBy);
  }
  if (options.difficulty) {
    query = query.eq("difficulty", options.difficulty);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`検証済みお題の取得に失敗しました: ${error.message}`);
  }
  let candidates = data;
  if (options.roomId) {
    const { data: usedGames, error: usedGamesError } = await createAdminClient()
      .from("games")
      .select("problem_id")
      .eq("room_id", options.roomId)
      .not("problem_id", "is", null);
    if (usedGamesError) {
      throw new Error(`ルームのお題履歴取得に失敗しました: ${usedGamesError.message}`);
    }
    const usedProblemIds = new Set(usedGames.map((game) => game.problem_id));
    const unusedCandidates = candidates.filter((problem) => !usedProblemIds.has(problem.id));
    if (unusedCandidates.length > 0) {
      candidates = unusedCandidates;
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
