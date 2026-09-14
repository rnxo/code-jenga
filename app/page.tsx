"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useCodeJenga } from "@/hooks/useCodeJenga";
import { GEMINI_PLAYER, type Verdict } from "@/lib/types";

// ここから下は見た目だけ。ゲームのロジックは useCodeJenga に入っているので、
// このファイルは丸ごと作り替えても動作は変わりません。

const VERDICT_BADGE: Record<Verdict, { text: string; className: string }> = {
  stable: { text: "安定", className: "bg-emerald-900 text-emerald-100" },
  wobbly: { text: "グラグラ", className: "bg-amber-900 text-amber-100" },
  collapsed: { text: "崩壊", className: "bg-red-900 text-red-100" },
};

export default function CodeJengaPage() {
  const { tower, gemini, testTower, playGeminiMove } = useCodeJenga();

  // フォームの入力値だけがこの画面のローカル状態
  const [inputCode, setInputCode] = useState('  console.log("Block added!");');
  const [playerName, setPlayerName] = useState("Player 1");

  const handleAdd = async () => {
    const error = await tower.addBlock(inputCode, playerName);
    if (!error) setInputCode("");
  };

  const badge = gemini.verdict ? VERDICT_BADGE[gemini.verdict] : null;

  return (
    <main className="min-h-full bg-neutral-950 p-5 text-neutral-100 sm:p-8">
      <h1 className="mb-2 text-2xl font-bold text-amber-500 sm:text-3xl">
        🧱 Code Jenga
      </h1>
      <p className="mb-3 text-sm text-neutral-400">
        コードを1行ずつ積み上げ、崩さずに耐えるゲーム。Gemini が対戦相手にも審判にもなります。
      </p>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded-md px-2.5 py-1.5 ${
            tower.isSyncedRemotely
              ? "bg-emerald-950 text-emerald-200"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {tower.isSyncedRemotely
            ? "● Supabase Realtime 接続モード"
            : "● ローカル同期モード（同一ブラウザの別タブ間で同期）"}
        </span>
        <span
          className={`rounded-md px-2.5 py-1.5 ${
            gemini.ready
              ? "bg-indigo-950 text-indigo-200"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {gemini.ready
            ? `🤖 Gemini 参戦中 (${gemini.model})`
            : "🤖 Gemini 未接続（GEMINI_API_KEY 未設定）"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 左: 入力・Gemini・コンソール */}
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-base font-semibold">新しいブロックを積む</h2>

            <label className="mb-3 flex items-center gap-2 text-xs text-neutral-400">
              プレイヤー名:
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-600"
              />
            </label>

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
                }}
              />
            </div>

            <button
              onClick={handleAdd}
              className="w-full cursor-pointer rounded bg-amber-500 px-3 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              ➕ タワーに積む
            </button>

            <button
              onClick={playGeminiMove}
              disabled={!gemini.ready || gemini.busy}
              title={
                gemini.ready ? "" : ".env.local に GEMINI_API_KEY を設定してください"
              }
              className="mt-2 w-full cursor-pointer rounded bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {gemini.busy ? "🤖 Gemini が思考中..." : "🤖 Gemini に一手積ませる"}
            </button>
          </section>

          <section className="min-h-24 rounded-lg border border-indigo-800 bg-neutral-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-indigo-300">
                🤖 Gemini 実況・審判
              </h2>
              {badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
                >
                  {badge.text}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
              {gemini.comment ||
                (gemini.ready
                  ? "待機中。「一手積ませる」か「タワーをテスト」で動き出します。"
                  : ".env.local に GEMINI_API_KEY を設定すると、Gemini が対戦相手兼・審判として参加します。")}
            </p>
          </section>

          <section className="h-44 overflow-y-auto rounded-lg border border-neutral-800 bg-black p-4">
            <h2 className="mb-2 text-sm font-semibold text-neutral-400">検証コンソール</h2>
            <pre className="font-mono text-[13px] whitespace-pre-wrap text-emerald-400">
              {tower.output}
            </pre>
          </section>
        </div>

        {/* 右: タワー */}
        <section className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              🏢 タワー（{tower.blocks.length} ブロック）
            </h2>
            <button
              onClick={testTower}
              disabled={tower.isRunning || tower.blocks.length === 0}
              className="cursor-pointer rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {tower.isRunning ? "検証中..." : "▶ タワーをテスト"}
            </button>
          </div>

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
                      className="cursor-pointer rounded bg-red-500 px-1.5 py-0.5 text-[11px] transition hover:bg-red-400"
                    >
                      抜き取る
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
