import "server-only";

import type { GamePlayer } from "@/types/game";

// 担当: BE-A
// left_at IS NULL の参加者の中で turn_order を巡回する（DB_DESIGN.md 4.5 補足）。

/** 試合を開始・継続するために必要な最小参加人数。 */
export const MIN_PLAYERS = 2;

/** 離脱していない参加者を turn_order 昇順で返す。 */
export function getActivePlayers(players: GamePlayer[]): GamePlayer[] {
  return players
    .filter((player) => player.left_at === null)
    .sort((first, second) => first.turn_order - second.turn_order);
}

/** 現在の手番プレイヤーの次に打つべきプレイヤーの ID を返す。途中離脱者は飛ばす。 */
export function getNextPlayerId(players: GamePlayer[], currentPlayerId: string): string {
  const activePlayers = getActivePlayers(players);
  if (activePlayers.length === 0) {
    throw new Error("手番を送れる参加者がいません。");
  }

  const currentIndex = activePlayers.findIndex((player) => player.player_id === currentPlayerId);
  if (currentIndex < 0) {
    throw new Error(`現在の手番プレイヤー ${currentPlayerId} が参加者一覧に存在しません。`);
  }
  return activePlayers[(currentIndex + 1) % activePlayers.length].player_id;
}

/**
 * 手番プレイヤーが離脱したときの次のプレイヤー ID を返す。
 * 離脱者は players 内で既に left_at がセットされている前提なので、
 * 「離脱者の turn_order より後ろで最初の現役プレイヤー、いなければ先頭」を選ぶ。
 */
export function getNextPlayerIdAfterLeave(players: GamePlayer[], leftPlayerId: string): string {
  const left = players.find((player) => player.player_id === leftPlayerId);
  if (!left) {
    throw new Error(`離脱したプレイヤー ${leftPlayerId} が参加者一覧に存在しません。`);
  }
  const activePlayers = getActivePlayers(players).filter((player) => player.player_id !== leftPlayerId);
  if (activePlayers.length === 0) {
    throw new Error("手番を送れる参加者がいません。");
  }
  const following = activePlayers.find((player) => player.turn_order > left.turn_order);
  return (following ?? activePlayers[0]).player_id;
}
