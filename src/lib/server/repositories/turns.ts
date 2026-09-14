import "server-only";

import type { Turn, TurnDifficulty, TurnResult } from "@/types/game";

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

export async function createTurn(input: CreateTurnInput): Promise<Turn> {
  throw new Error(`未実装: createTurn(${JSON.stringify(input)})`);
}

export async function listTurnsByGameId(gameId: string): Promise<Turn[]> {
  throw new Error(`未実装: listTurnsByGameId(${gameId})`);
}
