import type { Turn } from "@/types/game";

// セーフ / アウトの結果表示。担当: FE-B
//
// 抜かれた行を木片の見た目で出して、タワーから抜けた1枚だと分かるようにする。

export interface TestResultPanelProps {
  turn: Turn | null;
}

const RESULT: Record<Turn["result"], { label: string; tone: string; note: string }> = {
  safe: {
    label: "SAFE",
    tone: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
    note: "タワーは持ちこたえました。",
  },
  out: {
    label: "OUT",
    tone: "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
    note: "テストが落ちました。タワー崩壊です。",
  },
  timeout: {
    label: "TIMEOUT",
    tone: "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
    note: "時間切れです。",
  },
};

export function TestResultPanel({ turn }: TestResultPanelProps) {
  if (!turn) {
    return null;
  }

  const { label, tone, note } = RESULT[turn.result];
  const isSafe = turn.result === "safe";

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
          last result
        </span>
        <span
          className={`font-mono text-sm font-bold tracking-[0.15em] ${
            isSafe ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
          }`}
        >
          {label}
        </span>
      </div>

      {/* 抜かれた1枚。タワーの木片と同じ色にして、抜けたことが分かるようにする */}
      <div className="mt-2 flex items-center gap-3 rounded-sm bg-amber-600 px-3 py-2 shadow-sm">
        <span className="shrink-0 font-mono text-[10px] text-black/40">
          {String(turn.deleted_line_no).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 font-mono text-[13px] whitespace-pre-wrap text-black/85">
          {turn.deleted_line_text}
        </span>
      </div>

      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{note}</p>
    </div>
  );
}
