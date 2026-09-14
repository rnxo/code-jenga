"use client";

import { useEffect, useReducer } from "react";

/** games.turn_deadline_at までの残り秒数を1秒ごとに再計算する。期限が無い場合は 0。 */
export function useTurnTimer(turnDeadlineAt: string | null): number {
  // 残り秒数は turnDeadlineAt と現在時刻から毎レンダーで導出する（state に持たない）。
  // useEffect は「1秒ごとに再レンダーを起こす」という外部タイマーの購読だけを担う。
  const [, forceRerender] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    if (!turnDeadlineAt) {
      return;
    }

    const intervalId = setInterval(forceRerender, 1000);
    return () => clearInterval(intervalId);
  }, [turnDeadlineAt]);

  return computeRemainingSeconds(turnDeadlineAt);
}

function computeRemainingSeconds(turnDeadlineAt: string | null): number {
  if (!turnDeadlineAt) {
    return 0;
  }
  const diffMs = new Date(turnDeadlineAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}
