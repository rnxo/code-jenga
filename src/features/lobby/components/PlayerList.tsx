import type { GamePlayer } from "@/types/game";

// ロビー参加者一覧。担当: FE-A
// game_players には nickname が無いため（DB_DESIGN.md 4.5）、profiles との JOIN 結果を
// LobbyPlayer として呼び出し側で組み立てて渡すこと。

export interface LobbyPlayer extends GamePlayer {
  nickname: string;
}

export interface PlayerListProps {
  players: LobbyPlayer[];
  hostId: string;
}

export function PlayerList({ players, hostId }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => a.turn_order - b.turn_order);

  return (
    <ul className="flex flex-col gap-2">
      {sortedPlayers.map((player) => (
        <li
          key={player.player_id}
          className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
        >
          <span>
            {player.nickname}
            {player.player_id === hostId ? "（ホスト）" : ""}
          </span>
          <span className={player.is_ready ? "text-green-600" : "text-gray-400"}>
            {player.is_ready ? "準備完了" : "準備中"}
          </span>
        </li>
      ))}
    </ul>
  );
}
