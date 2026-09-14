"use client";

import { Button, ErrorBanner, Panel, ScreenHeader, Screen } from "@/components/ui";
import type { CodeJenga } from "@/hooks/useCodeJenga";

/** ⑤ 終了画面 */
export function ResultScreen({ game }: { game: CodeJenga }) {
  const { session, tower, loser } = game;
  const room = session.room;

  // 崩したかどうかは部屋の値で決める。players 由来の loser を使うと、
  // 崩した本人が退出した瞬間に全員の画面が「完走」に化ける。
  const collapsed = Boolean(room?.loser_id) || room?.verdict === "collapsed";
  // 名前は出せないこともある（退出済み）
  const loserName = loser?.name ?? "退出したプレイヤー";

  return (
    <Screen>
      <ScreenHeader
        eyebrow="step 05 / result"
        title={collapsed ? "タワー崩壊" : "完走"}
        lead={
          collapsed
            ? "抜いた一行が、タワーを支えていました。"
            : "最後まで崩れませんでした。全員の勝ちです。"
        }
      />

      <ErrorBanner message={session.error} onClose={session.clearError} />

      {/* 誰が崩したかを一番大きく */}
      <div
        className={`mb-6 rounded-lg px-4 py-4 ring-1 ${
          collapsed ? "bg-red-950/40 ring-red-900" : "bg-emerald-950/40 ring-emerald-900"
        }`}
      >
        <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          {collapsed ? "who pulled it" : "survivors"}
        </p>
        <p className="text-xl font-bold">
          {collapsed ? (
            <>
              <span className="text-red-400">{loserName}</span>
              <span className="text-neutral-400"> の負け</span>
            </>
          ) : (
            <span className="text-emerald-400">全員生還</span>
          )}
        </p>
      </div>

      <Panel title="last output" className="mb-4 !bg-black">
        <pre
          className={`max-h-40 overflow-y-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap ${
            collapsed ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {room?.last_output ?? tower.output ?? "(出力なし)"}
        </pre>
      </Panel>

      {room?.judge_comment && (
        <Panel accent title="gemini" className="mb-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
            {room.judge_comment}
          </p>
        </Panel>
      )}

      {/* 崩れたタワーとして、残った行を少し傾けて見せる */}
      <div className="mb-7">
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          {`remains · ${tower.blocks.length} 行`}
        </p>

        {tower.blocks.length === 0 ? (
          <p className="rounded-md bg-neutral-900 px-3 py-4 text-center text-sm text-neutral-500 ring-1 ring-neutral-800">
            すべて抜き切りました。
          </p>
        ) : (
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md bg-neutral-950 p-2.5">
            {tower.blocks.map((block, i) => (
              <div
                key={block.id}
                className={`flex h-9 items-center gap-3 rounded-sm px-3 ${
                  collapsed ? "bg-neutral-800" : "bg-amber-700"
                }`}
                style={
                  collapsed
                    ? { transform: `rotate(${((i % 3) - 1) * 0.7}deg)` }
                    : undefined
                }
              >
                <span
                  className={`shrink-0 font-mono text-[10px] ${
                    collapsed ? "text-neutral-600" : "text-black/40"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`truncate font-mono text-[12px] ${
                    collapsed ? "text-neutral-400" : "text-black/80"
                  }`}
                >
                  {block.code_snippet.trim()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {session.isHost ? (
        <Button className="w-full !py-3.5 !text-base" onClick={session.playAgain}>
          このまま もう一戦
        </Button>
      ) : (
        <p className="rounded-md bg-neutral-900 px-3 py-3 text-center text-xs text-neutral-500 ring-1 ring-neutral-800">
          ホストが「もう一戦」を選ぶと、待機画面に戻ります。
        </p>
      )}

      <button
        onClick={session.leaveRoom}
        className="mt-5 w-full cursor-pointer text-center font-mono text-[11px] tracking-[0.2em] text-red-500/80 uppercase transition hover:text-red-400"
      >
        {session.isHost ? "× disband" : "× leave"}
      </button>
    </Screen>
  );
}
