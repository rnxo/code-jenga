"use client";

import { Button } from "@/components/ui/Button";

// 行選択→削除確定 UI。担当: FE-B

export interface LineDeleteControlsProps {
  selectedLineNo: number | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
}

export function LineDeleteControls({
  selectedLineNo,
  isSubmitting,
  errorMessage,
  onConfirm,
}: LineDeleteControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-600">
        {selectedLineNo !== null
          ? `${selectedLineNo} 行目を削除します。`
          : "削除する行をコード上でクリックしてください。"}
      </p>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <Button variant="danger" disabled={selectedLineNo === null || isSubmitting} onClick={onConfirm}>
        {isSubmitting ? "判定中..." : "この行を削除する"}
      </Button>
    </div>
  );
}
