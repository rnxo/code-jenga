import "server-only";

import type { GamePlayer } from "@/types/game";

// 担当: BE-A
// left_at IS NULL の参加者の中で turn_order を巡回する（DB_DESIGN.md 4.5 補足）。

/** 現在の手番プレイヤーの次に打つべきプレイヤーの ID を返す。途中離脱者は飛ばす。 */
export function getNextPlayerId(players: GamePlayer[], currentPlayerId: string): string {
  throw new Error(
    `未実装: getNextPlayerId(currentPlayerId=${currentPlayerId}, players=${players.length}件)`,
  );
}
