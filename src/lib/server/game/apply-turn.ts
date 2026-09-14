import "server-only";

import type { Game, Turn } from "@/types/game";

// 担当: BE-A
// DB_DESIGN.md 5章-5: 1手の確定（この関数が全体の中核）。
//
// 1. games.current_player_id と playerId の一致を検証（手番外の操作を拒否）
// 2. games.current_code から lineNo 行目を除いたコードを組み立て、Piston でテスト実行
//    （@/lib/server/piston/run, @/lib/shared/code の deleteLine を使う）
// 3. judgeTurnResult（@/lib/server/game/judge）で判定し、以下を1トランザクションで実行:
//    test_runs INSERT → turns INSERT → games UPDATE
//    （safe なら次のプレイヤーへ手番を送る。out/timeout なら status='finished' にする）

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
