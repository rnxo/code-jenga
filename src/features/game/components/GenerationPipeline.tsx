import type { TestRunStatus } from "@/types/game";

// お題ができるまでの進み具合を見せる。担当: ようた（見た目）
//
// バックの処理（docs/problem-generation-runbook.md）はこの順で進む:
//   Gemini が sourceCode / testCode を生成
//     -> problems へ未検証で保存
//     -> Piston でテスト実行（test_runs に kind='problem_verification' で記録）
//     -> 全テスト成功なら is_verified=true、games.status='playing'
// 失敗したら最大3回まで作り直す。
//
// この部品は状態を受け取って描くだけ。どこまで進んだかの判定は呼び出し側（FE-B）。

/** いまどの工程にいるか */
export type GenerationStep = "generating" | "verifying" | "ready" | "failed";

/** 直近の検証結果（test_run_summaries の1行ぶん） */
export interface GenerationRunSummary {
  status: TestRunStatus;
  passedTests: number | null;
  totalTests: number | null;
  errorMessage: string | null;
}

export interface GenerationPipelineProps {
  step: GenerationStep;
  /** 何回目の作り直しか（1始まり） */
  attempt?: number;
  maxAttempts?: number;
  /** 直近の検証結果。まだ無ければ null */
  lastRun?: GenerationRunSummary | null;
}

interface StepDef {
  key: Exclude<GenerationStep, "failed">;
  label: string;
  note: string;
}

const STEPS: readonly StepDef[] = [
  { key: "generating", label: "AI がコードを書く", note: "お題とテストを生成しています" },
  { key: "verifying", label: "テストで検証する", note: "生成したコードを実行して確かめています" },
  { key: "ready", label: "タワーに積む", note: "検証を通ったお題を盤面に並べます" },
] as const;

/** 各段の状態。木片の見た目を切り替えるのに使う */
type StepState = "done" | "active" | "pending" | "failed";

function resolveStepState(step: GenerationStep, index: number): StepState {
  if (step === "failed") {
    // 失敗したのは必ず検証の段。生成は終わっている
    return index === 0 ? "done" : index === 1 ? "failed" : "pending";
  }
  const currentIndex = STEPS.findIndex((candidate) => candidate.key === step);
  if (index < currentIndex) {
    return "done";
  }
  return index === currentIndex ? "active" : "pending";
}

const STEP_CLASS: Record<StepState, string> = {
  done: "border-green-300 bg-green-50 text-green-900",
  active: "border-amber-500 bg-amber-100 text-amber-950 shadow-sm",
  pending: "border-amber-900/15 bg-amber-50/40 text-amber-900/45",
  failed: "border-red-300 bg-red-50 text-red-900",
};

const STEP_MARK: Record<StepState, string> = {
  done: "✓",
  active: "▶",
  pending: "・",
  failed: "×",
};

export function GenerationPipeline({
  step,
  attempt = 1,
  maxAttempts = 3,
  lastRun = null,
}: GenerationPipelineProps) {
  const isRetrying = attempt > 1;

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex w-full flex-col gap-3 rounded-lg border-2 border-amber-900/20 bg-amber-50/60 p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.25em] text-amber-900/50 uppercase">
          building the tower
        </p>
        {isRetrying ? (
          <p className="font-mono text-[11px] tabular-nums text-amber-900/60">
            {attempt} 回目 / 最大 {maxAttempts} 回
          </p>
        ) : null}
      </div>

      <ol className="flex flex-col gap-1.5">
        {STEPS.map((definition, index) => {
          const state = resolveStepState(step, index);
          return (
            <li
              key={definition.key}
              className={`flex items-center gap-3 rounded-sm border px-3 py-2 transition-colors ${STEP_CLASS[state]}`}
            >
              <span aria-hidden className="w-4 shrink-0 text-center font-mono text-xs">
                {STEP_MARK[state]}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{definition.label}</span>
                <span className="text-xs opacity-70">{definition.note}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* 検証の結果が来ていれば、通ったテストの数を出す */}
      {lastRun && lastRun.totalTests !== null ? (
        <p className="font-mono text-xs tabular-nums text-amber-900/70">
          テスト {lastRun.passedTests ?? 0} / {lastRun.totalTests} 通過
        </p>
      ) : null}

      {step === "failed" ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {lastRun?.errorMessage ?? "お題の検証に失敗しました。作り直しています。"}
        </p>
      ) : null}
    </section>
  );
}
