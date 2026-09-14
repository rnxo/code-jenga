import "server-only";

import type { Game } from "@/types/game";

// 担当: BE-A
// DB_DESIGN.md 5章-4: 試合開始（お題確定・先頭手番のセットアップ）
//
// ランダム難易度ルーレット（supabase/migrations/20260914092539_add_turn_difficulty.sql）:
// 先頭ターンの難易度を @/lib/shared/difficulty の rollTurnDifficulty(problem.source_code) で
// 抽選し、games UPDATE の current_turn_difficulty に含めること。rollTurnDifficulty は
// 削除可能行が0行の場合に自動で "easy" へフォールバックする。

export interface StartGameInput {
  gameId: string;
  turnTimeLimitSeconds: number;
}

export async function startGame(input: StartGameInput): Promise<Game> {
  throw new Error(`未実装: startGame(${JSON.stringify(input)})`);
}
