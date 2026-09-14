"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { runInBrowserSandbox } from "@/lib/sandbox";
import type { Block } from "@/lib/types";

export interface TowerRun {
  output: string;
  /** true なら崩壊（実行エラー・タイムアウト） */
  collapsed: boolean;
}

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
  /** 全ブロックを繋げて実行し、出力と崩壊したかどうかを返す */
  testTower: () => Promise<TowerRun>;
  /** 積み上がったコード全体（Gemini に渡す用など） */
  buildFullCode: () => string;
  /** 手動で取得し直す */
  refresh: () => Promise<void>;
}

/** roomId が null の間は何もしない（部屋に入る前） */
export function useJengaTower(roomId: string | null): JengaTower {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setBlocks([]);
      return;
    }

    const { data, error } = await supabase
      .from("jenga_blocks")
      .select("*")
      .eq("room_id", roomId)
      .order("block_index", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
    } else if (data) {
      setBlocks(data as Block[]);
    }
  }, [roomId]);

  // 初期ロード＋Realtime 購読（Supabase 未設定時は localStorage で別タブ間同期）
  useEffect(() => {
    if (!roomId) return;

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
  }, [roomId, refresh]);

  const addBlock = useCallback(
    async (codeSnippet: string, author: string) => {
      if (!roomId) return "部屋に入っていません";
      if (!codeSnippet.trim()) return "空のブロックは積めません";

      const block_index =
        blocks.length > 0 ? Math.max(...blocks.map((b) => b.block_index)) + 1 : 1;

      const { error } = await supabase.from("jenga_blocks").insert([
        {
          room_id: roomId,
          block_index,
          code_snippet: codeSnippet,
          player_name: author || "Anonymous",
        },
      ]);

      if (error) return error.message;
      await refresh();
      return null;
    },
    [roomId, blocks, refresh],
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

  const testTower = useCallback(async (): Promise<TowerRun> => {
    if (blocks.length === 0) return { output: "", collapsed: false };

    setIsRunning(true);
    setOutput("タワーの構造（コード）を検証中...");

    const fullCode = buildFullCode();
    let run: TowerRun;

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode, language: "typescript" }),
      });
      const data = await res.json();

      if (data.run) {
        const collapsed = data.run.code !== 0 || Boolean(data.run.stderr);
        run = {
          output: data.run.output || "実行成功: タワーは安定しています！",
          collapsed,
        };
      } else if (data.fallback) {
        // Piston が使えないので、ブラウザ内の sandbox iframe で実行する
        const sandboxed = await runInBrowserSandbox(fullCode);
        run = {
          output: `※ Piston 未接続のためブラウザ内サンドボックスで実行（JavaScript として評価）\n  ${data.error}\n\n${sandboxed.output}`,
          collapsed: !sandboxed.ok,
        };
      } else {
        run = {
          output: `崩壊エラー: ${data.error || "コードの構文・実行エラーが発生しました"}`,
          collapsed: true,
        };
      }
    } catch {
      run = { output: "通信エラーが発生しました。", collapsed: false };
    }

    setOutput(run.output);
    setIsRunning(false);
    return run;
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
