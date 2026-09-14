import "server-only";

import type { Game } from "@/types/game";

// 担当: BE-A
// DB_DESIGN.md 5章-4: 試合開始（お題確定・先頭手番のセットアップ）

export interface StartGameInput {
  gameId: string;
  turnTimeLimitSeconds: number;
}

export async function startGame(input: StartGameInput): Promise<Game> {
  throw new Error(`未実装: startGame(${JSON.stringify(input)})`);
}
