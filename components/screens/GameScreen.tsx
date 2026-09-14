"use client";

import { Backdrop } from "@/components/Backdrop";
import { ErrorBanner, Panel } from "@/components/ui";
import type { Verdict } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

const VERDICT_BADGE: Record<Verdict, { text: string; className: string }> = {
  stable: { text: "安定", className: "bg-emerald-950 text-emerald-300 ring-emerald-900" },
  wobbly: { text: "グラグラ", className: "bg-amber-950 text-amber-300 ring-amber-900" },
  collapsed: { text: "崩壊", className: "bg-red-950 text-red-300 ring-red-900" },
};

/** ④ コード画面。Gemini が作った舞台から1行ずつ抜いていく */
export function GameScreen({ game }: { game: CodeJenga }) {
  const { session, tower, gemini, currentPlayer, isMyTurn, pullBlock } = game;

  // 実行結果と Gemini のコメントは部屋で共有しているので、全員が同じものを見る
  const room = session.room;
  // 部屋側が空のラウンドでは、手元に残っている前回の出力を出さない
  const consoleText = tower.isRunning ? tower.output : (room?.last_output ?? "");
  const comment = gemini.busy ? gemini.comment : (room?.judge_comment ?? gemini.comment);
  const verdict = room?.verdict ?? gemini.verdict;
  const badge = verdict ? VERDICT_BADGE[verdict] : null;

  const canPull = isMyTurn && !tower.isRunning;

  return (
    <main className="min-h-dvh p-5 text-neutral-100 sm:p-8">
      <Backdrop />

      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
              step 04 / pull one line
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-amber-500 sm:text-3xl">
              {room?.stage_title ?? "…"}
            </h1>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-[11px] ring-1 ${
              gemini.ready
                ? "bg-indigo-950/60 text-indigo-300 ring-indigo-900"
                : "bg-neutral-900 text-neutral-500 ring-neutral-800"
            }`}
          >
            {gemini.ready ? `Gemini ${gemini.model}` : "Gemini 未接続（作り置きの舞台）"}
          </span>
        </header>

        <ErrorBanner message={session.error} onClose={session.clearError} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.15fr]">
          {/* 左: 手番・実況・実行結果 */}
          <div className="flex flex-col gap-4">
            {/* いま誰の番かを一番大きく出す */}
            <div
              className={`rounded-lg px-4 py-3.5 ring-1 ${
                isMyTurn
                  ? "bg-amber-950/40 ring-amber-800"
                  : "bg-neutral-900 ring-neutral-800"
              }`}
            >
              <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
                turn
              </p>
              <p className="text-lg font-bold">
                {isMyTurn ? (
                  <span className="text-amber-400">あなたの番です</span>
                ) : (
                  <span className="text-neutral-300">
                    {currentPlayer?.name ?? "-"} さんの番
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {tower.isRunning
                  ? "実行中..."
                  : isMyTurn
                    ? "1行選んで抜いてください。"
                    : "抜き終わるまで待ちます。"}
              </p>
            </div>

            <Panel
              accent
              title={
                <span className="flex items-center gap-2">
                  <span className="text-indigo-300">gemini</span>
                  {badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  )}
                </span>
              }
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
                {comment || "…"}
              </p>
            </Panel>

            <Panel title="output" className="h-56 overflow-y-auto !bg-black">
              <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-emerald-400">
                {consoleText || "まだ1行も抜かれていません。"}
              </pre>
            </Panel>

            <p className="text-xs leading-relaxed text-neutral-500">
              1行抜くたびにコードが実行されます。エラーになったら、抜いた人の負けです。
              全部抜ききれたら全員の勝ち。
            </p>
          </div>

          {/* 右: タワー */}
          <Panel title={`tower · 残り ${tower.blocks.length} 行`}>
            <div className="flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto rounded-md bg-neutral-950 p-2.5">
              {tower.blocks.length === 0 ? (
                <p className="p-5 text-center text-sm text-neutral-500">
                  タワーは空になりました
                </p>
              ) : (
                tower.blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className={`flex h-11 items-center gap-3 rounded-sm px-3 shadow-md shadow-black/40 transition-all ${
                      idx % 2 === 0 ? "bg-amber-600" : "bg-amber-700"
                    } ${canPull ? "hover:translate-x-1.5" : "opacity-45"}`}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-black/40">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate font-mono text-[13px] text-black/85">
                      {block.code_snippet.trim()}
                    </span>
                    <button
                      onClick={() => pullBlock(block.id)}
                      disabled={!canPull}
                      className="ml-auto shrink-0 cursor-pointer rounded-sm bg-black/25 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-black/70 uppercase transition hover:bg-black/40 disabled:cursor-not-allowed"
                    >
                      pull
                    </button>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
