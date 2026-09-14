import "server-only";

import type { GamePlayer } from "@/types/game";
import { createAdminClient } from "@/lib/supabase/admin";

// game_players テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface AddGamePlayerInput {
  gameId: string;
  playerId: string;
  turnOrder: number;
}

/** ゲームに参加者を追加する。 */
export async function addGamePlayer(input: AddGamePlayerInput): Promise<GamePlayer> {
  const { data, error } = await createAdminClient()
    .from("game_players")
    .insert({ game_id: input.gameId, player_id: input.playerId, turn_order: input.turnOrder })
    .select()
    .single();
  if (error) {
    throw new Error(`ゲーム参加者の登録に失敗しました: ${error.message}`);
  }
  return data;
}

/** ゲームの参加者を手番順で取得する。 */
export async function listGamePlayers(gameId: string): Promise<GamePlayer[]> {
  const { data, error } = await createAdminClient()
    .from("game_players")
    .select()
    .eq("game_id", gameId)
    .order("turn_order", { ascending: true });
  if (error) {
    throw new Error(`ゲーム参加者の取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** 再戦時、前局（fromGameId）の参加者を新しい games 行（toGameId）へコピーする（DB_DESIGN.md 5章-6）。 */
export async function copyGamePlayers(fromGameId: string, toGameId: string): Promise<GamePlayer[]> {
  const players = await listGamePlayers(fromGameId);
  if (players.length === 0) {
    return [];
  }
  const { data, error } = await createAdminClient()
    .from("game_players")
    .insert(players.map((player) => ({
      game_id: toGameId,
      player_id: player.player_id,
      turn_order: player.turn_order,
      is_ready: false,
    })))
    .select();
  if (error) {
    throw new Error(`ゲーム参加者のコピーに失敗しました: ${error.message}`);
  }
  return data;
}
