"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Button, ErrorBanner, Panel } from "@/components/ui";
import { GEMINI_PLAYER, type Verdict } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

const VERDICT_BADGE: Record<Verdict, { text: string; className: string }> = {
  stable: { text: "安定", className: "bg-emerald-900 text-emerald-100" },
  wobbly: { text: "グラグラ", className: "bg-amber-900 text-amber-100" },
  collapsed: { text: "崩壊", className: "bg-red-900 text-red-100" },
};

/** ④ コード画面。ゲーム本体 */
export function GameScreen({ game }: { game: CodeJenga }) {
  const { session, tower, gemini, currentPlayer, isMyTurn, placeBlock } = game;
  const [inputCode, setInputCode] = useState('  console.log("Block added!");');

  // 実行結果と Gemini のコメントは部屋で共有しているので、全員が同じものを見る
  const room = session.room;
  const consoleText = tower.isRunning ? tower.output : (room?.last_output ?? tower.output);
  const comment = gemini.busy ? gemini.comment : (room?.judge_comment ?? gemini.comment);
  const verdict = room?.verdict ?? gemini.verdict;

  const badge = verdict ? VERDICT_BADGE[verdict] : null;

  const handlePlace = async () => {
    const error = await placeBlock(inputCode);
    if (!error) setInputCode("");
  };

  return (
    <main className="min-h-full bg-neutral-950 p-5 text-neutral-100 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-amber-500">🧱 Code Jenga</h1>
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
        {/* 左: 入力・Gemini・コンソール */}
        <div className="flex flex-col gap-4">
          <Panel title={isMyTurn ? "あなたの番です" : `${currentPlayer?.name ?? "-"} さんの番`}>
            <div className="mb-3 h-32 overflow-hidden rounded border border-neutral-700">
              <Editor
                height="100%"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={inputCode}
                onChange={(val) => setInputCode(val ?? "")}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  readOnly: !isMyTurn,
                }}
              />
            </div>

            <Button className="w-full" onClick={handlePlace} disabled={!isMyTurn}>
              ➕ タワーに積む
            </Button>

            <Button
              variant="gemini"
              className="mt-2 w-full"
              onClick={game.playGeminiMove}
              disabled={!gemini.ready || gemini.busy}
              title={gemini.ready ? "" : ".env.local に GEMINI_API_KEY を設定してください"}
            >
              {gemini.busy ? "🤖 Gemini が思考中..." : "🤖 Gemini に一手積ませる"}
            </Button>
          </Panel>

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
              {comment ||
                (gemini.ready
                  ? "待機中。「一手積ませる」か「タワーをテスト」で動き出します。"
                  : ".env.local に GEMINI_API_KEY を設定すると、Gemini が対戦相手兼・審判として参加します。")}
            </p>
          </Panel>

          <Panel title="検証コンソール" className="h-44 overflow-y-auto !bg-black">
            <pre className="font-mono text-[13px] whitespace-pre-wrap text-emerald-400">
              {consoleText}
            </pre>
          </Panel>
        </div>

        {/* 右: タワー */}
        <Panel
          title={
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-base text-neutral-100">
                🏢 タワー（{tower.blocks.length} ブロック）
              </span>
              <Button
                variant="success"
                onClick={game.testTower}
                disabled={tower.isRunning || tower.blocks.length === 0}
              >
                {tower.isRunning ? "検証中..." : "▶ タワーをテスト"}
              </Button>
            </span>
          }
        >
          <div className="flex max-h-[32rem] flex-col-reverse gap-1.5 overflow-y-auto rounded-md bg-neutral-950 p-2.5">
            {tower.blocks.length === 0 ? (
              <p className="p-5 text-center text-sm text-neutral-500">
                ブロックがまだありません
              </p>
            ) : (
              tower.blocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={`flex items-center justify-between gap-2 rounded px-3 py-2 font-mono text-[13px] text-white shadow ${
                    block.player_name === GEMINI_PLAYER
                      ? "bg-indigo-700"
                      : idx % 2 === 0
                        ? "bg-amber-600"
                        : "bg-amber-700"
                  }`}
                >
                  <span className="truncate">{block.code_snippet}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
                      {block.player_name}
                    </span>
                    <button
                      onClick={() => tower.removeBlock(block.id)}
                      disabled={!isMyTurn}
                      className="cursor-pointer rounded bg-red-500 px-1.5 py-0.5 text-[11px] transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-neutral-700"
                    >
                      抜き取る
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}
