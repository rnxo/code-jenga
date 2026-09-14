"use client";

import { useCallback, useMemo } from "react";
import { useGameSession, type GameSession } from "./useGameSession";
import { useJengaTower, type JengaTower } from "./useJengaTower";
import { useGemini, type GeminiPlayer } from "./useGemini";
import { GEMINI_PLAYER, type Player } from "@/lib/types";

export interface CodeJenga {
  session: GameSession;
  tower: JengaTower;
  gemini: GeminiPlayer;
  /** いま手番のプレイヤー。参加順の巡回で決まる */
  currentPlayer: Player | null;
  /** 自分の手番かどうか。UI の活性制御に使う */
  isMyTurn: boolean;
  /** 崩したプレイヤー。決着前は null */
  loser: Player | null;
  /** 自分の手番としてブロックを積む */
  placeBlock: (codeSnippet: string) => Promise<string | null>;
  /** タワーを実行し、崩れたら決着、続けて Gemini に講評させる */
  testTower: () => Promise<void>;
  /** Gemini に一手考えさせ、そのままタワーに積む */
  playGeminiMove: () => Promise<void>;
}

/**
 * ゲーム全体のロジック。UI からはこれ1つを呼べば足りる。
 * 細かく制御したいときは useGameSession / useJengaTower / useGemini を
 * 直接使ってもよい。
 */
export function useCodeJenga(): CodeJenga {
  const session = useGameSession();
  const tower = useJengaTower(session.room?.id ?? null);
  const gemini = useGemini();

  const { players, me, room } = session;

  // 参加順に一巡ずつ。Gemini が積んだ分は手番を消費しない扱いにする
  const humanBlockCount = tower.blocks.filter(
    (b) => b.player_name !== GEMINI_PLAYER,
  ).length;

  const currentPlayer = useMemo(
    () => (players.length > 0 ? players[humanBlockCount % players.length] : null),
    [players, humanBlockCount],
  );

  const isMyTurn = Boolean(me && currentPlayer && me.id === currentPlayer.id);

  const loser = useMemo(
    () => players.find((p) => p.id === room?.loser_id) ?? null,
    [players, room],
  );

  const placeBlock = useCallback(
    async (codeSnippet: string) => {
      if (!me) return "部屋に入っていません";
      return tower.addBlock(codeSnippet, me.name);
    },
    [me, tower],
  );

  const testTower = useCallback(async () => {
    const run = await tower.testTower();
    if (!run.output) return;

    // 直前に積んだ人が崩した人
    const last = [...tower.blocks]
      .reverse()
      .find((b) => b.player_name !== GEMINI_PLAYER);
    const culprit = players.find((p) => p.name === last?.player_name) ?? null;

    // 実行結果は部屋に書いて全員の画面に出す
    await session.recordRun({
      output: run.output,
      collapsed: run.collapsed,
      loserId: culprit?.id ?? null,
    });

    if (gemini.ready) {
      const judged = await gemini.requestJudge(tower.blocks, run.output);
      if (judged) await session.recordJudge(judged);
    }
  }, [tower, players, session, gemini]);

  const playGeminiMove = useCallback(async () => {
    const move = await gemini.requestMove(tower.blocks);
    if (!move) return;

    const error = await tower.addBlock(move.code, GEMINI_PLAYER);
    if (error) {
      gemini.setComment(`追加エラー: ${error}`);
      return;
    }

    // 煽りコメントも全員の画面に出す
    await session.recordJudge({ verdict: null, comment: move.comment });
  }, [tower, gemini, session]);

  return {
    session,
    tower,
    gemini,
    currentPlayer,
    isMyTurn,
    loser,
    placeBlock,
    testTower,
    playGeminiMove,
  };
}
