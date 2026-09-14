import type { Turn } from "@/types/game";

// セーフ / アウトの結果表示。担当: FE-B

export interface TestResultPanelProps {
  turn: Turn | null;
}

const RESULT_LABEL: Record<Turn["result"], string> = {
  safe: "セーフ",
  out: "アウト",
  timeout: "タイムアウト",
};

export function TestResultPanel({ turn }: TestResultPanelProps) {
  if (!turn) {
    return null;
  }

  const isSafe = turn.result === "safe";

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        isSafe
          ? "border-green-300 bg-green-50 text-green-800"
          : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      直前の判定: {RESULT_LABEL[turn.result]}（削除行: {turn.deleted_line_no} 行目「
      {turn.deleted_line_text}」）
    </div>
  );
}
