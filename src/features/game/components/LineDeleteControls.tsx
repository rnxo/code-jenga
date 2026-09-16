"use client";

import { Button } from "@/components/ui/Button";

// 行選択→削除確定 UI。担当: ようた（見た目・#26）

export interface LineDeleteControlsProps {
  selectedLineNo: number | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  /** 現在の難易度の縛りにより選択行が削除できない場合の理由。null なら削除可能。 */
  blockedReason: string | null;
  onConfirm: () => void;
}

export function LineDeleteControls({
  selectedLineNo,
  isSubmitting,
  errorMessage,
  blockedReason,
  onConfirm,
}: LineDeleteControlsProps) {
  const isSelected = selectedLineNo !== null;
  const isBlocked = blockedReason !== null;
  const canConfirm = isSelected && !isBlocked && !isSubmitting;

  return (
    <section
      // 覚悟を決める枠なので、がっかりのトロンボーン
      data-silly-sound="womp"
      className={`flex flex-col gap-2 rounded-lg border-2 p-3 ${
        canConfirm ? "border-red-400 bg-red-50/50" : "border-amber-900/20 bg-amber-50/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-900/50">
          pull
        </span>
        {isSelected ? (
          <span className="rounded-sm border border-amber-300 bg-white px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-amber-800">
            {selectedLineNo} 行目
          </span>
        ) : (
          <span className="text-xs text-amber-900/60">削除する行をコード上でクリック</span>
        )}
      </div>

      {/* 縛りに引っかかっている理由はボタンのすぐ上に出す（押せない理由が分かるように） */}
      {blockedReason ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {blockedReason}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <Button
        variant="danger"
        className="w-full"
        disabled={!canConfirm}
        onClick={onConfirm}
        // 指を止めて確定したときに、カメラ操作がこのボタンを押す（HandPointer）。
        // 盤面が縦に長いとボタンは画面の外なので、指では直接狙えない
        data-hand-confirm=""
      >
        {isSubmitting ? "判定中..." : "この行を削除する"}
      </Button>
    </section>
  );
}
