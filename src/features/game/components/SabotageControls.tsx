"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

// 相手の手番に「邪魔する」を押す枠。担当: FE-B
// 自分の手番では同じ場所に LineDeleteControls が出る（GameBoardPlayfield 側で出し分ける）。

export interface SabotageControlsProps {
  /** 送れる状態か（購読済み・このターンは未使用） */
  canSend: boolean;
  /** このターンにもう送ったか */
  usedThisTurn: boolean;
  errorMessage: string | null;
  onSend: () => Promise<void>;
}

export function SabotageControls({ canSend, usedThisTurn, errorMessage, onSend }: SabotageControlsProps) {
  const [isSending, setIsSending] = useState(false);

  async function handleClick() {
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      // 悪だくみの枠なので、いたずらっぽいラズベリー
      data-silly-sound="raspberry"
      className={`flex flex-col gap-2 rounded-lg border-2 p-3 ${
        canSend ? "border-amber-400 bg-amber-50/60" : "border-amber-900/20 bg-amber-50/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-900/50">
          mischief
        </span>
        <span className="text-xs text-amber-900/60">
          {usedThisTurn ? "このターンはもう邪魔した。次のターンにまた使える" : "おせっかいくんが相手のタワーを回しに行く（1ターン1回）"}
        </span>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <Button
        variant="secondary"
        className="w-full border border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200"
        disabled={!canSend || isSending}
        onClick={handleClick}
      >
        {isSending ? "送っています..." : usedThisTurn ? "邪魔した！" : "😏 タワーを回して邪魔する"}
      </Button>
    </section>
  );
}
