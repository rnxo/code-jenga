"use client";

import type { Game } from "@/types/game";
import { useTurnTimer } from "../hooks/useTurnTimer";

// 手番表示＋残り時間。担当: FE-B
//
// タワーと同じ言語で組む（mono の小さな見出し + 木の色のアクセント）。
// 自分の番のときだけ左端に木の色が入り、盤面を見ずとも手番が分かるようにする。

export interface TurnIndicatorProps {
  game: Game;
  isMyTurn: boolean;
}

/** 残り時間がこの割合を切ったら警告色にする */
const DANGER_RATIO = 0.25;

export function TurnIndicator({ game, isMyTurn }: TurnIndicatorProps) {
  const remainingSeconds = useTurnTimer(game.turn_deadline_at);

  const limitSeconds = game.turn_time_limit_seconds;
  const ratio = limitSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / limitSeconds)) : 0;
  const isDanger = ratio <= DANGER_RATIO;

  return (
    <div
      className={`rounded-lg border border-l-4 px-4 py-3 ${
        isMyTurn
          ? "border-amber-300 border-l-amber-500 bg-amber-50/60 dark:border-amber-900 dark:border-l-amber-600 dark:bg-amber-950/30"
          : "border-gray-200 border-l-gray-300 dark:border-gray-800 dark:border-l-gray-700"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
          turn {game.turn_no}
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
          残り {game.current_line_count ?? "-"} 行
        </span>
      </div>

      <p
        className={`mt-1 text-lg font-bold ${
          isMyTurn ? "text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {isMyTurn ? "あなたの番です" : "相手の番です"}
      </p>

      <div className="mt-2 flex items-center gap-3">
        {/* 残り時間。減っていくのが目で分かるようにバーで出す */}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
              isDanger ? "bg-red-500" : "bg-amber-500"
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span
          className={`font-mono text-sm tabular-nums ${
            isDanger ? "font-bold text-red-600 dark:text-red-400" : "text-gray-500"
          }`}
        >
          {remainingSeconds}s
        </span>
      </div>
    </div>
  );
}
