import "server-only";

import type { Turn, TurnResult } from "@/types/game";

// turns テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface CreateTurnInput {
  gameId: string;
  turnNo: number;
  playerId: string;
  deletedLineNo: number;
  deletedLineText: string;
  codeBefore: string;
  codeAfter: string;
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
