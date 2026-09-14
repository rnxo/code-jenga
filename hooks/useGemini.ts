"use client";

import { useCallback, useEffect, useState } from "react";
import type { Block, GeminiMove, Verdict } from "@/lib/types";

export interface GeminiPlayer {
  /** サーバーに GEMINI_API_KEY があるか。false ならボタンを無効化する */
  ready: boolean;
  /** 使用中のモデル名（表示用） */
  model: string;
  /** 思考中／講評中かどうか */
  busy: boolean;
  /** 直近のコメント。エラー時は「⚠ 〜」が入る */
  comment: string;
  /** 直近の判定。まだ判定していなければ null */
  verdict: Verdict | null;
  /** 次の一手を考えさせる。失敗したら null */
  requestMove: (blocks: Block[]) => Promise<GeminiMove | null>;
  /** 実行結果を講評させる。結果は部屋で共有できるよう呼び出し側に返す */
  requestJudge: (
    blocks: Block[],
    output: string,
  ) => Promise<{ verdict: Verdict | null; comment: string } | null>;
  /** UI 側から実況を差し込みたいとき用 */
  setComment: (comment: string) => void;
}

/** Gemini に渡すのは中身だけでよいので、id などは落とす */
function toPrompt(blocks: Block[]) {
  return blocks.map(({ code_snippet, player_name }) => ({
    code_snippet,
    player_name,
  }));
}

export function useGemini(): GeminiPlayer {
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

  const requestMove = useCallback(async (blocks: Block[]) => {
    setBusy(true);
    setVerdict(null);
    setComment("Gemini が次の一手を考えています...");

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "move", blocks: toPrompt(blocks) }),
      });
      const data = await res.json();

      if (data.error) {
        setComment(`⚠ ${data.error}`);
        return null;
      }

      setComment(data.comment ?? "");
      return { code: data.code, comment: data.comment ?? "" } as GeminiMove;
    } catch {
      setComment("⚠ Gemini との通信に失敗しました");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const requestJudge = useCallback(async (blocks: Block[], output: string) => {
    setBusy(true);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "judge", blocks: toPrompt(blocks), output }),
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
  }, []);

  return { ready, model, busy, comment, verdict, requestMove, requestJudge, setComment };
}
