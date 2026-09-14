"use client";

import { Button, ErrorBanner } from "@/components/ui";
import { TowerArt } from "@/components/TowerArt";
import { MAX_PLAYERS } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

const RULES = [
  { step: "1", text: "Gemini が動くコードを1本つくる。それがタワー。" },
  { step: "2", text: "順番に1行ずつ抜く。抜いたらその場で実行される。" },
  { step: "3", text: "エラーが出たら崩壊。抜いた人の負け。" },
];

/** ① スタート画面 */
export function StartScreen({ game }: { game: CodeJenga }) {
  const { session, gemini } = game;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12 text-neutral-100">
      <div className="relative w-full max-w-sm">
        <header className="mb-8 text-center">
          <p className="mb-2 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
            pull one line
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-amber-500">
            Code Jenga
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Gemini が組んだコードから、1行ずつ抜いていく。
            <br />
            崩したら負け。
          </p>
        </header>

        <TowerArt />

        <ErrorBanner message={session.error} onClose={session.clearError} />

        <div className="flex flex-col gap-3">
          <Button className="!py-3.5 !text-base" onClick={() => session.goTo("create")}>
            部屋を作る
          </Button>
          <Button
            variant="secondary"
            className="!py-3.5 !text-base"
            onClick={() => session.goTo("join")}
          >
            合言葉で参加する
          </Button>
        </div>

        <ol className="mt-8 flex flex-col gap-2.5">
          {RULES.map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3 text-xs text-neutral-400">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[10px] text-amber-500">
                {step}
              </span>
              <span className="leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>

        <footer className="mt-8 flex flex-wrap justify-center gap-2 text-[11px]">
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-neutral-500 ring-1 ring-neutral-800">
            ホスト含め {MAX_PLAYERS} 人 / 1マッチ
          </span>
          <span
            className={`rounded-full px-3 py-1 ring-1 ${
              session.isSyncedRemotely
                ? "bg-emerald-950/60 text-emerald-300 ring-emerald-900"
                : "bg-neutral-900 text-neutral-500 ring-neutral-800"
            }`}
          >
            {session.isSyncedRemotely ? "全端末同期" : "ローカル同期（別タブのみ）"}
          </span>
          <span
            className={`rounded-full px-3 py-1 ring-1 ${
              gemini.ready
                ? "bg-indigo-950/60 text-indigo-300 ring-indigo-900"
                : "bg-neutral-900 text-neutral-500 ring-neutral-800"
            }`}
          >
            {gemini.ready ? `Gemini ${gemini.model}` : "Gemini 未接続（作り置きの舞台）"}
          </span>
        </footer>
      </div>
    </main>
  );
}
