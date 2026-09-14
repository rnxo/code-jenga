"use client";

import type { Game, TurnDifficulty } from "@/types/game";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT } from "@/lib/shared/difficulty";
import { useTurnTimer } from "../hooks/useTurnTimer";

// 手番表示＋残り時間＋ランダム難易度ルーレットのバッジ。担当: FE-B

export interface TurnIndicatorProps {
  game: Game;
  isMyTurn: boolean;
}

const DIFFICULTY_BADGE_CLASS: Record<TurnDifficulty, string> = {
  easy: "border-green-300 bg-green-50 text-green-800",
  normal: "border-amber-300 bg-amber-50 text-amber-800",
  hard: "border-red-300 bg-red-50 text-red-800",
};

export function TurnIndicator({ game, isMyTurn }: TurnIndicatorProps) {
  const remainingSeconds = useTurnTimer(game.turn_deadline_at);
  const difficulty = game.current_turn_difficulty;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className={isMyTurn ? "font-semibold text-blue-600" : "text-gray-600"}>
          {isMyTurn ? "あなたの手番です" : "相手の手番です"}（{game.turn_no} 手目 / 残り{" "}
          {game.current_line_count ?? "-"} 行）
        </span>
        <span className="tabular-nums text-gray-500">残り {remainingSeconds} 秒</span>
      </div>
      {difficulty ? (
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${DIFFICULTY_BADGE_CLASS[difficulty]}`}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </span>
          <span className="text-xs text-gray-500">{DIFFICULTY_RULE_TEXT[difficulty]}</span>
        </div>
      ) : null}
    </div>
  );
}
