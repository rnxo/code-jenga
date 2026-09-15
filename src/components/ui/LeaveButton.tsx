"use client";

// 退出ボタン。担当ゾーン: 共有（1ファイル1コンポーネント）。
// 見た目だけを持ち、実際の退出（apiClient.leaveGame）は呼び出し側で配線する。

export interface LeaveButtonProps {
  onLeave: () => void;
  /** 退出リクエストの送信中。押せなくする */
  isLeaving?: boolean;
  /** ロビーは "normal"、盤面は誤爆しにくいよう "quiet" を想定 */
  size?: "normal" | "quiet";
  label?: string;
}

const SIZE_CLASS: Record<NonNullable<LeaveButtonProps["size"]>, string> = {
  normal: "w-full rounded-md border border-gray-300 px-4 py-2 text-sm",
  quiet: "mx-auto rounded-md px-3 py-1 text-xs",
};

export function LeaveButton({
  onLeave,
  isLeaving = false,
  size = "normal",
  label = "ルームを出る",
}: LeaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onLeave}
      disabled={isLeaving}
      className={[
        "text-gray-500 transition-colors hover:text-gray-800",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE_CLASS[size],
      ].join(" ")}
    >
      {isLeaving ? "退出中..." : label}
    </button>
  );
}
