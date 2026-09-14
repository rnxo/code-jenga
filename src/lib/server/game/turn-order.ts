import "server-only";

import type { GamePlayer } from "@/types/game";

// 担当: BE-A
// left_at IS NULL の参加者の中で turn_order を巡回する（DB_DESIGN.md 4.5 補足）。

/** 現在の手番プレイヤーの次に打つべきプレイヤーの ID を返す。途中離脱者は飛ばす。 */
export function getNextPlayerId(players: GamePlayer[], currentPlayerId: string): string {
  const activePlayers = players
    .filter((player) => player.left_at === null)
    .sort((first, second) => first.turn_order - second.turn_order);
  if (activePlayers.length === 0) {
    throw new Error("手番を送れる参加者がいません。");
  }

  const currentIndex = activePlayers.findIndex((player) => player.player_id === currentPlayerId);
  if (currentIndex < 0) {
    throw new Error(`現在の手番プレイヤー ${currentPlayerId} が参加者一覧に存在しません。`);
  }
  return activePlayers[(currentIndex + 1) % activePlayers.length].player_id;
}
