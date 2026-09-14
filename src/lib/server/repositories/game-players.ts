import "server-only";

import type { GamePlayer } from "@/types/game";

// game_players テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface AddGamePlayerInput {
  gameId: string;
  playerId: string;
  turnOrder: number;
}

export async function addGamePlayer(input: AddGamePlayerInput): Promise<GamePlayer> {
  throw new Error(`未実装: addGamePlayer(${JSON.stringify(input)})`);
}

export async function listGamePlayers(gameId: string): Promise<GamePlayer[]> {
  throw new Error(`未実装: listGamePlayers(${gameId})`);
}

/** 再戦時、前局（fromGameId）の参加者を新しい games 行（toGameId）へコピーする（DB_DESIGN.md 5章-6）。 */
export async function copyGamePlayers(fromGameId: string, toGameId: string): Promise<GamePlayer[]> {
  throw new Error(`未実装: copyGamePlayers(${fromGameId}, ${toGameId})`);
}
