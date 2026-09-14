"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { runInBrowserSandbox } from "@/lib/sandbox";
import { DEFAULT_GAME_ID, type Block } from "@/lib/types";

export interface JengaTower {
  /** 下から順に並んだブロック。UI 側で好きに描画してよい */
  blocks: Block[];
  /** true なら全端末で同期、false なら同一ブラウザの別タブ間のみ */
  isSyncedRemotely: boolean;
  /** 直近の実行結果。エラー文言もここに入る */
  output: string;
  /** タワーを検証中かどうか */
  isRunning: boolean;
  /** 積む。失敗したらエラーメッセージ、成功したら null */
  addBlock: (codeSnippet: string, author: string) => Promise<string | null>;
  /** 抜き取る。失敗したらエラーメッセージ、成功したら null */
  removeBlock: (id: string) => Promise<string | null>;
  /** 全ブロックを繋げて実行し、結果の文字列を返す */
  testTower: () => Promise<string>;
  /** 積み上がったコード全体（Gemini に渡す用など） */
  buildFullCode: () => string;
  /** 手動で取得し直す */
  refresh: () => Promise<void>;
}

export function useJengaTower(): JengaTower {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const refresh = useCallback(async () => {
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

  // 初期ロード＋Realtime 購読（Supabase 未設定時は localStorage で別タブ間同期）
  useEffect(() => {
    const channel = supabase
      .channel("jenga_realtime_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jenga_blocks" },
        () => refresh(),
      )
      // 購読が確立してから初回ロードする（エフェクト本体で直接 setState しない）
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const addBlock = useCallback(
    async (codeSnippet: string, author: string) => {
      if (!codeSnippet.trim()) return "空のブロックは積めません";

      const block_index =
        blocks.length > 0 ? Math.max(...blocks.map((b) => b.block_index)) + 1 : 1;

      const { error } = await supabase.from("jenga_blocks").insert([
        {
          game_id: DEFAULT_GAME_ID,
          block_index,
          code_snippet: codeSnippet,
          player_name: author || "Anonymous",
        },
      ]);

      if (error) return error.message;
      await refresh();
      return null;
    },
    [blocks, refresh],
  );

  const removeBlock = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("jenga_blocks").delete().eq("id", id);
      if (error) return error.message;
      await refresh();
      return null;
    },
    [refresh],
  );

  const buildFullCode = useCallback(
    () =>
      `function startJenga() {\n${blocks
        .map((b) => b.code_snippet)
        .join("\n")}\n}\nstartJenga();`,
    [blocks],
  );

  const testTower = useCallback(async () => {
    if (blocks.length === 0) return "";

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
        // Piston が使えないので、ブラウザ内の sandbox iframe で実行する
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
    return result;
  }, [blocks, buildFullCode]);

  return {
    blocks,
    isSyncedRemotely: isSupabaseConfigured,
    output,
    isRunning,
    addBlock,
    removeBlock,
    testTower,
    buildFullCode,
    refresh,
  };
}
