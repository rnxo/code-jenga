"use client";

import { useCallback, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { runInBrowserSandbox } from "@/lib/sandbox";

interface Block {
  id: string;
  code_snippet: string;
  player_name: string;
  block_index: number;
}

type Verdict = "stable" | "wobbly" | "collapsed" | "";

const DEFAULT_GAME_ID = "00000000-0000-0000-0000-000000000000";
const GEMINI_PLAYER = "🤖 Gemini";

const VERDICT_LABEL: Record<Exclude<Verdict, "">, { text: string; className: string }> = {
  stable: { text: "安定", className: "bg-emerald-900 text-emerald-100" },
  wobbly: { text: "グラグラ", className: "bg-amber-900 text-amber-100" },
  collapsed: { text: "崩壊", className: "bg-red-900 text-red-100" },
};

export default function CodeJenga() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [inputCode, setInputCode] = useState('  console.log("Block added!");');
  const [playerName, setPlayerName] = useState("Player 1");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const [geminiReady, setGeminiReady] = useState(false);
  const [geminiModel, setGeminiModel] = useState("");
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiComment, setGeminiComment] = useState("");
  const [geminiVerdict, setGeminiVerdict] = useState<Verdict>("");

  const fetchBlocks = useCallback(async () => {
    const { data, error } = await supabase
      .from("jenga_blocks")
      .select("*")
      .order("block_index", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
    } else if (data) {
      setBlocks(data as Block[]);
    }
  }, []);

  // 初期ロード＋Realtime 購読（Supabase 未設定時は localStorage で同一ブラウザ間同期）
  useEffect(() => {
    const channel = supabase
      .channel("jenga_realtime_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jenga_blocks" },
        () => fetchBlocks(),
      )
      // 購読が確立してから初回ロードする（エフェクト本体で直接 setState しない）
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchBlocks();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBlocks]);

  // Gemini の鍵がサーバーに設定されているかを確認
  useEffect(() => {
    fetch("/api/gemini")
      .then((r) => r.json())
      .then((d) => {
        setGeminiReady(Boolean(d.configured));
        setGeminiModel(d.model ?? "");
      })
      .catch(() => setGeminiReady(false));
  }, []);

  const nextIndex = () =>
    blocks.length > 0 ? Math.max(...blocks.map((b) => b.block_index)) + 1 : 1;

  const addBlock = async (codeSnippet: string, author: string) => {
    const { error } = await supabase.from("jenga_blocks").insert([
      {
        game_id: DEFAULT_GAME_ID,
        block_index: nextIndex(),
        code_snippet: codeSnippet,
        player_name: author || "Anonymous",
      },
    ]);
    if (!error) await fetchBlocks();
    return error;
  };

  const handleAddBlock = async () => {
    if (!inputCode.trim()) return;
    const error = await addBlock(inputCode, playerName);
    if (error) {
      setOutput(`追加エラー: ${error.message}`);
    } else {
      setInputCode("");
    }
  };

  const handleRemoveBlock = async (id: string) => {
    const { error } = await supabase.from("jenga_blocks").delete().eq("id", id);
    if (error) {
      setOutput(`削除エラー: ${error.message}`);
    } else {
      await fetchBlocks();
    }
  };

  const buildFullCode = () =>
    `function startJenga() {\n${blocks
      .map((b) => b.code_snippet)
      .join("\n")}\n}\nstartJenga();`;

  // Gemini に講評させる
  const askGeminiJudge = async (runOutput: string) => {
    setGeminiBusy(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "judge",
          output: runOutput,
          blocks: blocks.map(({ code_snippet, player_name }) => ({
            code_snippet,
            player_name,
          })),
        }),
      });
      const data = await res.json();

      if (data.error) {
        setGeminiComment(`⚠ ${data.error}`);
      } else {
        setGeminiVerdict((data.verdict as Verdict) ?? "");
        setGeminiComment(data.comment ?? "");
      }
    } catch {
      setGeminiComment("⚠ Gemini との通信に失敗しました");
    } finally {
      setGeminiBusy(false);
    }
  };

  // タワー全体を実行して安定性を検証する
  const handleTestTower = async () => {
    if (blocks.length === 0) return;
    setIsRunning(true);
    setOutput("タワーの構造（コード）を検証中...");

    const fullCode = buildFullCode();
    let result: string;

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode, language: "typescript" }),
      });
      const data = await res.json();

      if (data.run) {
        result = data.run.output || "実行成功: タワーは安定しています！";
      } else if (data.fallback) {
        const sandboxed = await runInBrowserSandbox(fullCode);
        result = `※ Piston 未接続のためブラウザ内サンドボックスで実行（JavaScript として評価）\n  ${data.error}\n\n${sandboxed}`;
      } else {
        result = `崩壊エラー: ${data.error || "コードの構文・実行エラーが発生しました"}`;
      }
    } catch {
      result = "通信エラーが発生しました。";
    }

    setOutput(result);
    setIsRunning(false);

    if (geminiReady) await askGeminiJudge(result);
  };

  // Gemini に次の一手を積ませる
  const handleGeminiMove = async () => {
    setGeminiBusy(true);
    setGeminiVerdict("");
    setGeminiComment("Gemini が次の一手を考えています...");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "move",
          blocks: blocks.map(({ code_snippet, player_name }) => ({
            code_snippet,
            player_name,
          })),
        }),
      });
      const data = await res.json();

      if (data.error) {
        setGeminiComment(`⚠ ${data.error}`);
        return;
      }

      const error = await addBlock(data.code, GEMINI_PLAYER);
      setGeminiComment(error ? `追加エラー: ${error.message}` : (data.comment ?? ""));
    } catch {
      setGeminiComment("⚠ Gemini との通信に失敗しました");
    } finally {
      setGeminiBusy(false);
    }
  };

  const verdictBadge = geminiVerdict ? VERDICT_LABEL[geminiVerdict] : null;

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
            isSupabaseConfigured
              ? "bg-emerald-950 text-emerald-200"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {isSupabaseConfigured
            ? "● Supabase Realtime 接続モード"
            : "● ローカル同期モード（同一ブラウザの別タブ間で同期）"}
        </span>
        <span
          className={`rounded-md px-2.5 py-1.5 ${
            geminiReady ? "bg-indigo-950 text-indigo-200" : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {geminiReady
            ? `🤖 Gemini 参戦中 (${geminiModel})`
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
              onClick={handleAddBlock}
              className="w-full cursor-pointer rounded bg-amber-500 px-3 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              ➕ タワーに積む
            </button>

            <button
              onClick={handleGeminiMove}
              disabled={!geminiReady || geminiBusy}
              title={geminiReady ? "" : ".env.local に GEMINI_API_KEY を設定してください"}
              className="mt-2 w-full cursor-pointer rounded bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            >
              {geminiBusy ? "🤖 Gemini が思考中..." : "🤖 Gemini に一手積ませる"}
            </button>
          </section>

          <section className="min-h-24 rounded-lg border border-indigo-800 bg-neutral-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-indigo-300">🤖 Gemini 実況・審判</h2>
              {verdictBadge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${verdictBadge.className}`}
                >
                  {verdictBadge.text}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
              {geminiComment ||
                (geminiReady
                  ? "待機中。「一手積ませる」か「タワーをテスト」で動き出します。"
                  : ".env.local に GEMINI_API_KEY を設定すると、Gemini が対戦相手兼・審判として参加します。")}
            </p>
          </section>

          <section className="h-44 overflow-y-auto rounded-lg border border-neutral-800 bg-black p-4">
            <h2 className="mb-2 text-sm font-semibold text-neutral-400">検証コンソール</h2>
            <pre className="font-mono text-[13px] whitespace-pre-wrap text-emerald-400">
              {output}
            </pre>
          </section>
        </div>

        {/* 右: タワー */}
        <section className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">🏢 タワー（{blocks.length} ブロック）</h2>
            <button
              onClick={handleTestTower}
              disabled={isRunning || blocks.length === 0}
              className="cursor-pointer rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {isRunning ? "検証中..." : "▶ タワーをテスト"}
            </button>
          </div>

          <div className="flex max-h-[32rem] flex-col-reverse gap-1.5 overflow-y-auto rounded-md bg-neutral-950 p-2.5">
            {blocks.length === 0 ? (
              <p className="p-5 text-center text-sm text-neutral-500">
                ブロックがまだありません
              </p>
            ) : (
              blocks.map((block, idx) => (
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
                      onClick={() => handleRemoveBlock(block.id)}
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
