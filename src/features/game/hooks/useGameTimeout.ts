"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api/client";

const TIMEOUT_GRACE_MS = 1500;
const TIMEOUT_RETRY_MS = 3000;

/** 手番の締切を検知して、サーバー側のタイムアウト確定を依頼する。 */
export function useGameTimeout(gameId: string, gameStatus: string | null, deadlineAt: string | null) {
  useEffect(() => {
    if (gameStatus !== "playing" || !deadlineAt) {
      return;
    }

    const delayMs = new Date(deadlineAt).getTime() - Date.now() + TIMEOUT_GRACE_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      void apiClient.timeoutTurn(gameId).then((result) => {
        if (!result.ok) {
          console.error(`タイムアウトの確定に失敗しました: ${result.error.message}`);
          retryTimer = setTimeout(() => void apiClient.timeoutTurn(gameId), TIMEOUT_RETRY_MS);
        }
      });
    }, Math.max(0, delayMs));

    return () => {
      clearTimeout(timer);
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [deadlineAt, gameId, gameStatus]);
}