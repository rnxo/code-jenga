import type { Turn, TurnResult } from "@/types/game";

// セーフ / アウトの結果表示。担当: ようた（見た目・#26）

export interface TestResultPanelProps {
  turn: Turn | null;
}

const RESULT_LABEL: Record<TurnResult, string> = {
  safe: "セーフ",
  out: "アウト",
  timeout: "タイムアウト",
};

/** 結果ごとの配色。safe だけ緑、それ以外は「タワーが揺れた」側として赤系に寄せる。 */
const RESULT_CLASS: Record<TurnResult, { frame: string; stamp: string }> = {
  safe: {
    frame: "border-green-300 bg-green-50",
    stamp: "border-green-400 bg-green-100 text-green-800",
  },
  out: {
    frame: "border-red-300 bg-red-50",
    stamp: "border-red-400 bg-red-100 text-red-800",
  },
  timeout: {
    frame: "border-orange-300 bg-orange-50",
    stamp: "border-orange-400 bg-orange-100 text-orange-800",
  },
};

export function TestResultPanel({ turn }: TestResultPanelProps) {
  if (!turn) {
    return null;
  }

  const style = RESULT_CLASS[turn.result];

  return (
    <section className={`flex flex-col gap-2 rounded-lg border-2 p-3 ${style.frame}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/40">
          last move
        </span>
        <span
          className={`rounded-sm border px-2 py-0.5 text-xs font-bold tracking-wider ${style.stamp}`}
        >
          {RESULT_LABEL[turn.result]}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-black/40">
          {turn.deleted_line_no} 行目
        </span>
      </div>

      {/* 抜かれた行。積み木を1本抜いた見立てで、木の色の板に乗せる */}
      <pre className="overflow-x-auto rounded-sm bg-amber-700/90 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-black/85">
        {turn.deleted_line_text}
      </pre>
    </section>
  );
}
