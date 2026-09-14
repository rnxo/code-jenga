"use client";

import type { Game } from "@/types/game";
import { useTurnTimer } from "../hooks/useTurnTimer";

// 手番表示＋残り時間。担当: FE-B

export interface TurnIndicatorProps {
  game: Game;
  isMyTurn: boolean;
}

export function TurnIndicator({ game, isMyTurn }: TurnIndicatorProps) {
  const remainingSeconds = useTurnTimer(game.turn_deadline_at);

  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
      <span className={isMyTurn ? "font-semibold text-blue-600" : "text-gray-600"}>
        {isMyTurn ? "あなたの手番です" : "相手の手番です"}（{game.turn_no} 手目 / 残り{" "}
        {game.current_line_count ?? "-"} 行）
      </span>
      <span className="tabular-nums text-gray-500">残り {remainingSeconds} 秒</span>
    </div>
  );
}
