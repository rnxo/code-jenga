"use client";

import { Button, ErrorBanner, Panel } from "@/components/ui";
import type { Verdict } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

const VERDICT_BADGE: Record<Verdict, { text: string; className: string }> = {
  stable: { text: "安定", className: "bg-emerald-900 text-emerald-100" },
  wobbly: { text: "グラグラ", className: "bg-amber-900 text-amber-100" },
  collapsed: { text: "崩壊", className: "bg-red-900 text-red-100" },
};

/** ④ コード画面。Gemini が作った舞台から1行ずつ抜いていく */
export function GameScreen({ game }: { game: CodeJenga }) {
  const { session, tower, gemini, currentPlayer, isMyTurn, pullBlock } = game;

  // 実行結果と Gemini のコメントは部屋で共有しているので、全員が同じものを見る
  const room = session.room;
  const consoleText = tower.isRunning ? tower.output : (room?.last_output ?? tower.output);
  const comment = gemini.busy ? gemini.comment : (room?.judge_comment ?? gemini.comment);
  const verdict = room?.verdict ?? gemini.verdict;
  const badge = verdict ? VERDICT_BADGE[verdict] : null;

  const canPull = isMyTurn && !tower.isRunning;

  return (
    <main className="min-h-dvh p-5 text-neutral-100 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-500">🧱 Code Jenga</h1>
          <p className="text-xs text-neutral-400">
            舞台: {room?.stage_title ?? "..."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-neutral-800 px-2.5 py-1.5 text-neutral-300">
            手番: <strong className="text-amber-400">{currentPlayer?.name ?? "-"}</strong>
            {isMyTurn && <span className="ml-1 text-emerald-400">（あなた）</span>}
          </span>
          <span
            className={`rounded-md px-2.5 py-1.5 ${
              gemini.ready
                ? "bg-indigo-950 text-indigo-200"
                : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {gemini.ready ? `🤖 ${gemini.model}` : "🤖 Gemini 未接続"}
          </span>
        </div>
      </div>

      <ErrorBanner message={session.error} onClose={session.clearError} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 左: 実況とコンソール */}
        <div className="flex flex-col gap-4">
          <Panel
            accent
            title={
              <span className="flex items-center gap-2">
                <span className="text-indigo-300">🤖 Gemini 実況・審判</span>
                {badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                )}
              </span>
            }
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
              {comment || "..."}
            </p>
          </Panel>

          <Panel title="実行結果" className="h-64 overflow-y-auto !bg-black">
            <pre className="font-mono text-[13px] whitespace-pre-wrap text-emerald-400">
              {consoleText || "まだ1行も抜かれていません。"}
            </pre>
          </Panel>

          <p className="text-xs leading-relaxed text-neutral-500">
            1行抜くたびにコードが実行されます。エラーになったら、抜いた人の負けです。
            全部抜ききれたら全員の勝ち。
          </p>
        </div>

        {/* 右: タワー */}
        <Panel
          title={
            <span className="text-base text-neutral-100">
              🏢 タワー（残り {tower.blocks.length} 行）
            </span>
          }
        >
          <div className="flex max-h-[34rem] flex-col gap-1.5 overflow-y-auto rounded-md bg-neutral-950 p-2.5">
            {tower.blocks.length === 0 ? (
              <p className="p-5 text-center text-sm text-neutral-500">
                タワーは空になりました
              </p>
            ) : (
              tower.blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={`flex items-center justify-between gap-2 rounded px-3 py-2 font-mono text-[13px] text-white shadow ${
                    idx % 2 === 0 ? "bg-amber-600" : "bg-amber-700"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[10px] text-black/50">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{block.code_snippet.trim()}</span>
                  </span>
                  <Button
                    variant="danger"
                    onClick={() => pullBlock(block.id)}
                    disabled={!canPull}
                    className="shrink-0 !px-2 !py-1 !text-[11px]"
                  >
                    抜き取る
                  </Button>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}
