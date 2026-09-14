"use client";

import { useCallback } from "react";
import { useJengaTower, type JengaTower } from "./useJengaTower";
import { useGemini, type GeminiPlayer } from "./useGemini";
import { GEMINI_PLAYER } from "@/lib/types";

export interface CodeJenga {
  tower: JengaTower;
  gemini: GeminiPlayer;
  /** タワーを実行し、続けて Gemini に講評させる */
  testTower: () => Promise<void>;
  /** Gemini に一手考えさせ、そのままタワーに積む */
  playGeminiMove: () => Promise<void>;
}

/**
 * ゲーム全体のロジック。UI からはこれ1つを呼べば足りる。
 * 細かく制御したいときは useJengaTower / useGemini を直接使ってもよい。
 */
export function useCodeJenga(): CodeJenga {
  const tower = useJengaTower();
  const gemini = useGemini();

  const testTower = useCallback(async () => {
    const result = await tower.testTower();
    if (result && gemini.ready) {
      await gemini.requestJudge(tower.blocks, result);
    }
  }, [tower, gemini]);

  const playGeminiMove = useCallback(async () => {
    const move = await gemini.requestMove(tower.blocks);
    if (!move) return;

    const error = await tower.addBlock(move.code, GEMINI_PLAYER);
    if (error) gemini.setComment(`追加エラー: ${error}`);
  }, [tower, gemini]);

  return { tower, gemini, testTower, playGeminiMove };
}
