"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useGameSession, type GameSession } from "./useGameSession";
import { useJengaTower, type JengaTower } from "./useJengaTower";
import { useGemini, type GeminiHost } from "./useGemini";
import type { Player } from "@/lib/types";

export interface CodeJenga {
  session: GameSession;
  tower: JengaTower;
  gemini: GeminiHost;
  /** Gemini が舞台を作っている最中かどうか */
  isGenerating: boolean;
  /** いま手番のプレイヤー。参加順の巡回で決まる */
  currentPlayer: Player | null;
  /** 自分の手番かどうか。抜き取りボタンの活性制御に使う */
  isMyTurn: boolean;
  /** 崩した人。最後まで残った場合は null */
  loser: Player | null;
  /** 1行抜く。抜いた直後に実行して、崩れたら決着 */
  pullBlock: (id: string) => Promise<void>;
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

  const { players, me, room, isHost } = session;
  const isGenerating = room?.phase === "generating";

  // 生成はホストの端末だけが1回だけ走らせる。
  // 生成中でなくなったら忘れて、次の一戦でまた走れるようにする。
  const generatingFor = useRef<string | null>(null);

  useEffect(() => {
    if (!room || room.phase !== "generating") {
      generatingFor.current = null;
      return;
    }
    if (!isHost) return;
    if (generatingFor.current === room.id) return;
    generatingFor.current = room.id;

    (async () => {
      const stage = await gemini.buildStage(players.length);
      const error = await tower.seedStage(stage.lines);

      if (error) {
        session.clearError();
        gemini.setComment(`⚠ 舞台を並べられませんでした: ${error}`);
        generatingFor.current = null;
        return;
      }

      await session.beginPlaying({
        stageTitle: stage.title,
        comment: stage.comment,
      });
    })();
  }, [room, isHost, players.length, gemini, tower, session]);

  const currentPlayer = useMemo(() => {
    if (players.length === 0) return null;
    return players[(room?.turn_index ?? 0) % players.length];
  }, [players, room]);

  const isMyTurn = Boolean(me && currentPlayer && me.id === currentPlayer.id);

  const loser = useMemo(
    () => players.find((p) => p.id === room?.loser_id) ?? null,
    [players, room],
  );

  const pullBlock = useCallback(
    async (id: string) => {
      if (!me || !isMyTurn || tower.isRunning) return;

      const target = tower.blocks.find((b) => b.id === id);
      if (!target) return;

      const remaining = tower.blocks.filter((b) => b.id !== id);

      const error = await tower.removeBlock(id);
      if (error) {
        gemini.setComment(`⚠ 抜き取りに失敗しました: ${error}`);
        return;
      }

      const run = await tower.runCode(remaining.map((b) => b.code_snippet));
      const emptied = remaining.length === 0;

      // 実行結果は部屋に書いて全員の画面に出す
      await session.recordRun({
        output: run.output,
        // 崩れた、または抜ける行が無くなったら決着
        collapsed: run.collapsed || emptied,
        loserId: run.collapsed ? me.id : null,
      });

      if (!run.collapsed && !emptied) await session.advanceTurn();

      if (gemini.ready) {
        const judged = await gemini.requestJudge(
          remaining,
          run.output,
          target.code_snippet,
        );
        if (judged) await session.recordJudge(judged);
      }
    },
    [me, isMyTurn, tower, session, gemini],
  );

  return {
    session,
    tower,
    gemini,
    isGenerating,
    currentPlayer,
    isMyTurn,
    loser,
    pullBlock,
  };
}
