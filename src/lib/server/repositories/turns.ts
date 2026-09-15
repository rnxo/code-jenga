import "server-only";

import type { Turn, TurnDifficulty, TurnResult } from "@/types/game";
import { createAdminClient } from "@/lib/supabase/admin";

// turns テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface CreateTurnInput {
  gameId: string;
  turnNo: number;
  playerId: string;
  deletedLineNo: number;
  deletedLineText: string;
  codeBefore: string;
  codeAfter: string;
  /** この手に適用されていた難易度（ランダム難易度ルーレット）のスナップショット。 */
  turnDifficulty: TurnDifficulty;
  result: TurnResult;
  testRunId: string | null;
  durationMs?: number;
}

/** 1手分の削除履歴を保存する。 */
export async function createTurn(input: CreateTurnInput): Promise<Turn> {
  const { data, error } = await createAdminClient()
    .from("turns")
    .insert({
      game_id: input.gameId,
      turn_no: input.turnNo,
      player_id: input.playerId,
      deleted_line_no: input.deletedLineNo,
      deleted_line_text: input.deletedLineText,
      code_before: input.codeBefore,
      code_after: input.codeAfter,
      turn_difficulty: input.turnDifficulty,
      result: input.result,
      test_run_id: input.testRunId,
      duration_ms: input.durationMs,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`手番履歴の保存に失敗しました: ${error.message}`);
  }
  return data;
}

/** ゲームの手番履歴を時系列で取得する。 */
export async function listTurnsByGameId(gameId: string): Promise<Turn[]> {
  const { data, error } = await createAdminClient()
    .from("turns")
    .select()
    .eq("game_id", gameId)
    .order("turn_no", { ascending: true });
  if (error) {
    throw new Error(`手番履歴の取得に失敗しました: ${error.message}`);
  }
  return data;
}
