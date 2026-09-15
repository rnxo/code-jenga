import type { GamePlayer } from "@/types/game";

// ロビー参加者一覧。担当: FE-A
// game_players には nickname が無いため（DB_DESIGN.md 4.5）、profiles との JOIN 結果を
// LobbyPlayer として呼び出し側で組み立てて渡すこと。
//
// 参加者を積み木として下から積む。人が増えるほどタワーが高くなり、
// 準備できた人の段に明かりが入る。

export interface LobbyPlayer extends GamePlayer {
  nickname: string;
}

export interface PlayerListProps {
  players: LobbyPlayer[];
  hostId: string;
  /** 空き枠をいくつ見せるか（rooms.max_players から渡す。未指定なら出さない） */
  maxPlayers?: number;
}

export function PlayerList({ players, hostId, maxPlayers }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => a.turn_order - b.turn_order);
  const emptySeats = Math.max(0, (maxPlayers ?? players.length) - players.length);

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
        {maxPlayers ? `players · ${players.length} / ${maxPlayers}` : "players"}
      </p>

      {/* 下から積み上がるので、先に入った人が一番下になる */}
      <ul className="flex flex-col-reverse gap-1.5">
        {sortedPlayers.map((player, index) => (
          <li
            key={player.player_id}
            className={`flex h-11 items-center gap-3 rounded-sm px-3 text-sm shadow-sm ${
              player.is_ready
                ? "bg-amber-600 text-black/85"
                : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            <span
              className={`shrink-0 font-mono text-[10px] ${
                player.is_ready ? "text-black/40" : "text-gray-500"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="truncate">{player.nickname}</span>

            {player.player_id === hostId ? (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  player.is_ready
                    ? "bg-black/20 text-black/70"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                ホスト
              </span>
            ) : null}

            <span
              className={`ml-auto shrink-0 font-mono text-[10px] tracking-[0.15em] uppercase ${
                player.is_ready ? "text-black/60" : "text-gray-500"
              }`}
            >
              {player.is_ready ? "ready" : "waiting"}
            </span>
          </li>
        ))}

        {Array.from({ length: emptySeats }).map((_, index) => (
          <li
            key={`empty-${index}`}
            className="flex h-11 items-center gap-3 rounded-sm border border-dashed border-gray-300 px-3 text-sm text-gray-400 dark:border-gray-700 dark:text-gray-600"
          >
            <span className="shrink-0 font-mono text-[10px]">
              {String(players.length + index + 1).padStart(2, "0")}
            </span>
            空き
          </li>
        ))}
      </ul>

      {/* 台 */}
      <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
    </div>
  );
}
