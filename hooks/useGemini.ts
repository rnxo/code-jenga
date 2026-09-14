"use client";

import { useCallback, useEffect, useState } from "react";
import { pickFallbackStage } from "@/lib/fallbackStage";
import type { Block, Stage, Verdict } from "@/lib/types";

export interface GeminiHost {
  /** サーバーに GEMINI_API_KEY があるか。false なら作り置きの舞台を使う */
  ready: boolean;
  /** 使用中のモデル名（表示用） */
  model: string;
  /** 生成中／講評中かどうか */
  busy: boolean;
  /** 直近のコメント。エラー時は「⚠ 〜」が入る */
  comment: string;
  /** 直近の判定。まだ判定していなければ null */
  verdict: Verdict | null;
  /** ゲームの舞台になるコードを作らせる。鍵が無ければ作り置きを返す */
  buildStage: (playerCount: number) => Promise<Stage>;
  /** 1行抜いたあとの状態を講評させる */
  requestJudge: (
    blocks: Block[],
    output: string,
    removed: string,
  ) => Promise<{ verdict: Verdict | null; comment: string } | null>;
  /** UI 側から実況を差し込みたいとき用 */
  setComment: (comment: string) => void;
}

export function useGemini(): GeminiHost {
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // 鍵がサーバーに設定されているかを確認する（鍵そのものは受け取らない）
  useEffect(() => {
    fetch("/api/gemini")
      .then((r) => r.json())
      .then((d) => {
        setReady(Boolean(d.configured));
        setModel(d.model ?? "");
      })
      .catch(() => setReady(false));
  }, []);

  const buildStage = useCallback(async (playerCount: number): Promise<Stage> => {
    setBusy(true);
    setVerdict(null);
    setComment("Gemini が舞台を組み立てています...");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "build", playerCount }),
      });
      const data = await res.json();

      const lines: string[] = Array.isArray(data.lines) ? data.lines : [];
      if (data.error || lines.length === 0) {
        // 鍵が無い・生成に失敗した場合は作り置きの舞台で続行する
        const fallback = pickFallbackStage();
        setComment(
          data.missingKey
            ? `${fallback.comment}\n（GEMINI_API_KEY が未設定のため、作り置きの舞台を使っています）`
            : `${fallback.comment}\n（Gemini の生成に失敗したため作り置きの舞台を使います: ${data.error ?? "不明なエラー"}）`,
        );
        return fallback;
      }

      const stage: Stage = {
        title: data.title ?? "名もなき舞台",
        lines,
        comment: data.comment ?? "",
      };
      setComment(stage.comment);
      return stage;
    } catch {
      const fallback = pickFallbackStage();
      setComment(
        `${fallback.comment}\n（Gemini との通信に失敗したため作り置きの舞台を使います）`,
      );
      return fallback;
    } finally {
      setBusy(false);
    }
  }, []);

  const requestJudge = useCallback(
    async (blocks: Block[], output: string, removed: string) => {
      setBusy(true);

      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "judge",
            output,
            removed,
            blocks: blocks.map(({ code_snippet }) => ({ code_snippet })),
          }),
        });
        const data = await res.json();

        if (data.error) {
          setComment(`⚠ ${data.error}`);
          return null;
        }

        const judged = {
          verdict: (data.verdict as Verdict) ?? null,
          comment: (data.comment as string) ?? "",
        };
        setVerdict(judged.verdict);
        setComment(judged.comment);
        return judged;
      } catch {
        setComment("⚠ Gemini との通信に失敗しました");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { ready, model, busy, comment, verdict, buildStage, requestJudge, setComment };
}
