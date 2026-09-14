import "server-only";

import type { Game, Turn } from "@/types/game";

// 担当: BE-A
// DB_DESIGN.md 5章-5: 1手の確定（この関数が全体の中核）。
//
// 1. games.current_player_id と playerId の一致を検証（手番外の操作を拒否）
// 1.5. ランダム難易度ルーレット（supabase/migrations/20260914092539_add_turn_difficulty.sql）:
//    games.current_turn_difficulty と対象行のテキストを
//    @/lib/shared/difficulty の isDeletableUnder(difficulty, lineText) で検証する。
//    false なら Piston を呼ぶ前に ApplicationError("LINE_NOT_DELETABLE", ...) を投げる
//    （エラーメッセージは DIFFICULTY_LABEL / DIFFICULTY_RULE_TEXT を使って組み立てる）。
// 2. games.current_code から lineNo 行目を除いたコードを組み立て、Piston でテスト実行
//    （@/lib/server/piston/run, @/lib/shared/code の deleteLine を使う）
// 3. judgeTurnResult（@/lib/server/game/judge）で判定し、以下を1トランザクションで実行:
//    test_runs INSERT → turns INSERT（turnDifficulty に手順1.5で検証した現在の難易度を渡す）
//    → games UPDATE
//    （safe なら次のプレイヤーへ手番を送る。このとき @/lib/shared/difficulty の
//    rollTurnDifficulty(codeAfter) で次ターンの難易度を抽選し、同じ games UPDATE の
//    current_turn_difficulty に含めること。抽選には DB から読み直した値ではなく、
//    今まさに書き込む codeAfter を渡す。out/timeout なら status='finished' にする）

export interface ApplyTurnInput {
  gameId: string;
  playerId: string;
  lineNo: number;
}

export interface ApplyTurnResult {
  turn: Turn;
  game: Game;
}

export async function applyTurn(input: ApplyTurnInput): Promise<ApplyTurnResult> {
  throw new Error(`未実装: applyTurn(${JSON.stringify(input)})`);
}
