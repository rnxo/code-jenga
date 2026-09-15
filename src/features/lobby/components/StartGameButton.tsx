"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api/client";

// ホストの「試合開始」。担当: FE-A
//
// rooms/[code]/page.tsx の TODO(FE-A) のうち、開始ボタンぶんをここに切り出す。
// 準備完了トグルは API（src/types/api.ts）がまだ無いので、こちらでは作れない。

export interface StartGameButtonProps {
  gameId: string;
  /** ホスト以外には出さない */
  isHost: boolean;
  playerCount: number;
  /** 何人そろえば始められるか */
  minPlayers?: number;
}

export function StartGameButton({
  gameId,
  isHost,
  playerCount,
  minPlayers = 2,
}: StartGameButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isHost) {
    return (
      <p className="text-center text-xs text-gray-500">
        ホストが開始するまでお待ちください。
      </p>
    );
  }

  const canStart = playerCount >= minPlayers && !isSubmitting;

  async function handleStart() {
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await apiClient.startGame(gameId, {});

    if (!result.ok) {
      setErrorMessage(result.error.message);
      setIsSubmitting(false);
    }
    // 成功したら games.status が playing になり、Realtime で盤面に切り替わる
  }

  return (
    <div className="flex flex-col gap-2">
      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <Button className="w-full" disabled={!canStart} onClick={handleStart}>
        {isSubmitting ? "開始中..." : "試合を開始する"}
      </Button>

      <p className="text-center text-xs text-gray-500">
        {playerCount < minPlayers
          ? `あと ${minPlayers - playerCount} 人そろうと開始できます。`
          : "全員そろいました。開始できます。"}
      </p>
    </div>
  );
}
