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
  /** 上から順に並んだタワーの各行 */
  blocks: Block[];
  /** true なら全端末で同期、false なら同一ブラウザの別タブ間のみ */
  isSyncedRemotely: boolean;
  /** 直近の実行結果。エラー文言もここに入る */
  output: string;
  /** 実行中かどうか */
  isRunning: boolean;
  /** Gemini が作った舞台をタワーとして並べ直す */
  seedStage: (lines: string[]) => Promise<string | null>;
  /** 1行抜く */
  removeBlock: (id: string) => Promise<string | null>;
  /** 指定した行の並びを実行する。抜いた直後の状態を渡す */
  runCode: (lines: string[]) => Promise<TowerRun>;
  /** タワー全体を1つのプログラムとして組み立てる */
  buildFullCode: (lines?: string[]) => string;
  /** 手動で取得し直す */
  refresh: () => Promise<void>;
}

function assemble(lines: string[]) {
  return `function startJenga() {\n${lines.join("\n")}\n}\nstartJenga();`;
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

  // タワーの変更を購読する（Supabase 未設定時は localStorage で別タブ間同期）
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel("jenga_blocks_channel")
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

  const seedStage = useCallback(
    async (lines: string[]) => {
      if (!roomId) return "部屋に入っていません";

      // 前のゲームの残りを消してから並べ直す
      await supabase.from("jenga_blocks").delete().eq("room_id", roomId);
      setOutput("");

      const { error } = await supabase.from("jenga_blocks").insert(
        lines.map((code_snippet, i) => ({
          room_id: roomId,
          block_index: i + 1,
          code_snippet,
        })),
      );

      if (error) return error.message;
      await refresh();
      return null;
    },
    [roomId, refresh],
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
    (lines?: string[]) => assemble(lines ?? blocks.map((b) => b.code_snippet)),
    [blocks],
  );

  const runCode = useCallback(async (lines: string[]): Promise<TowerRun> => {
    setIsRunning(true);
    setOutput("タワーが揺れています...");

    const fullCode = assemble(lines);
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
          output: data.run.output || "実行成功: タワーは持ちこたえました！",
          collapsed,
        };
      } else if (data.fallback) {
        // Piston が使えないので、ブラウザ内の sandbox iframe で実行する
        const sandboxed = await runInBrowserSandbox(fullCode);
        run = { output: sandboxed.output, collapsed: !sandboxed.ok };
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
  }, []);

  return {
    blocks,
    isSyncedRemotely: isSupabaseConfigured,
    output,
    isRunning,
    seedStage,
    removeBlock,
    runCode,
    buildFullCode,
    refresh,
  };
}
