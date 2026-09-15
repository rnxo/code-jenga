"use client";

import type { Game, TurnDifficulty } from "@/types/game";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT } from "@/lib/shared/difficulty";
import { useTurnTimer } from "../hooks/useTurnTimer";

// 手番表示＋残り時間＋ランダム難易度ルーレットのバッジ。担当: ようた（見た目・#26）

export interface TurnIndicatorProps {
  game: Game;
  isMyTurn: boolean;
}

const DIFFICULTY_BADGE_CLASS: Record<TurnDifficulty, string> = {
  easy: "border-green-300 bg-green-50 text-green-800",
  normal: "border-amber-300 bg-amber-50 text-amber-800",
  hard: "border-red-300 bg-red-50 text-red-800",
};

/** 残りがこの秒数以下になったら赤くして急かす。 */
const HURRY_SECONDS = 10;

export function TurnIndicator({ game, isMyTurn }: TurnIndicatorProps) {
  const remainingSeconds = useTurnTimer(game.turn_deadline_at);
  const difficulty = game.current_turn_difficulty;
  const limitSeconds = game.turn_time_limit_seconds;
  // 0 除算と、時計のズレで 100% を超えるのを避ける
  const remainingRatio =
    limitSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / limitSeconds)) : 0;
  const isHurrying = remainingSeconds <= HURRY_SECONDS;

  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border-2 p-3 ${
        isMyTurn ? "border-amber-600 bg-amber-50" : "border-amber-900/20 bg-amber-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-900/50">
            {isMyTurn ? "your turn" : "waiting"}
          </p>
          <p
            className={`text-base font-bold ${isMyTurn ? "text-amber-950" : "text-amber-900/60"}`}
          >
            {isMyTurn ? "あなたの手番です" : "相手の手番です"}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-amber-900/50">
            {game.turn_no} 手目 / 残り {game.current_line_count ?? "-"} 行
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-900/50">
            time
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              isHurrying ? "text-red-600" : "text-amber-900"
            }`}
          >
            {remainingSeconds}
            <span className="ml-0.5 text-xs font-normal">秒</span>
          </p>
        </div>
      </div>

      {/* 残り時間のバー。数字より先に「あとどれくらいか」が目に入るように */}
      <div className="h-1.5 overflow-hidden rounded-full bg-amber-900/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            isHurrying ? "bg-red-500" : "bg-amber-600"
          }`}
          style={{ width: `${remainingRatio * 100}%` }}
        />
      </div>

      {difficulty ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${DIFFICULTY_BADGE_CLASS[difficulty]}`}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </span>
          <span className="text-xs text-amber-900/70">{DIFFICULTY_RULE_TEXT[difficulty]}</span>
        </div>
      ) : null}
    </section>
  );
}
