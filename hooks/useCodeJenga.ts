"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession, type GameSession } from "./useGameSession";
import { useJengaTower, type JengaTower } from "./useJengaTower";
import { useGemini, type GeminiHost } from "./useGemini";
import type { Player, Screen } from "@/lib/types";

/** 崩れる様子を見せてから、終了画面に移るまでの時間 */
const COLLAPSE_VIEW_MS = 2000;

export interface CodeJenga {
  session: GameSession;
  /** 表示すべき画面。崩壊中はコード画面に留めて、崩れるところを見せる */
  screen: Screen;
  /** タワーが崩れている最中か */
  isCollapsing: boolean;
  tower: JengaTower;
  gemini: GeminiHost;
  /** Gemini が舞台を作っている最中かどうか（取りに行く前・生成中の両方） */
  isGenerating: boolean;
  /** 生成を取った人が落ちていて、誰でも作り直せる状態か */
  canRetryStage: boolean;
  /** 止まっている生成を引き取ってやり直す */
  retryStage: () => Promise<void>;
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
  const tower = useJengaTower(session.room?.id ?? null, session.room?.round ?? 1);
  const gemini = useGemini();

  const { players, me, room } = session;

  // 取りに行く前（generating）と、誰かが取って作っている最中（seeding）の両方
  const isGenerating = room?.phase === "generating" || room?.phase === "seeding";
  const canRetryStage = session.isStaleClaim;

  /**
   * 舞台を作る。
   *
   * 「誰が作るか」は DB 側の条件つき更新で決めるので、ホストかどうかは見ない。
   * 取れた1人だけが先に進み、その人が落ちても 60 秒後に別の人が引き取れる。
   */
  const runStageGeneration = useCallback(async () => {
    if (!room) return;

    const won = await session.claimStage();
    if (!won) return;

    const playerCount = players.length;

    // Supabase があるならサーバーに投げる。以降はサーバーで走るので、
    // ここで呼んだタブが閉じられても最後まで進む。
    if (tower.isSyncedRemotely) {
      try {
        const res = await fetch("/api/play/stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id, playerCount }),
        });

        // 成功したら Realtime で playing が飛んでくるので、ここでは何もしない
        if (res.ok) return;
      } catch {
        // 落ちたら下のクライアント生成に回る
      }
    }

    // Supabase 無し、またはサーバーが駄目だったときは、このタブで作る
    const stage = await gemini.buildStage(playerCount);
    const error = await tower.seedStage(stage.lines);

    if (error) {
      gemini.setComment(`⚠ 舞台を並べられませんでした: ${error}`);
      await session.releaseStage();
      return;
    }

    await session.beginPlaying({
      stageTitle: stage.title,
      comment: stage.comment,
    });
  }, [room, players.length, session, tower, gemini]);

  useEffect(() => {
    // seeding は誰かが持っているので触らない（引き取りは retryStage から）
    if (!room || room.phase !== "generating") return;
    runStageGeneration();
  }, [room, runStageGeneration]);

  const currentPlayer = useMemo(() => {
    if (players.length === 0) return null;
    return players[(room?.turn_index ?? 0) % players.length];
  }, [players, room]);

  const isMyTurn = Boolean(me && currentPlayer && me.id === currentPlayer.id);

  // 決着した瞬間、すぐ終了画面に飛ばすと崩れるところが見えないので、
  // しばらくコード画面に留めてタワーを崩す。全員の端末で同じように起きる。
  const finishedKey =
    room?.phase === "finished" && room.loser_id ? `${room.id}:${room.round}` : null;

  const [seenFinish, setSeenFinish] = useState<string | null>(null);
  const [isCollapsing, setIsCollapsing] = useState(false);

  if (finishedKey && finishedKey !== seenFinish) {
    // 描画中に前回値と比べて調整する形（エフェクトを挟まない）
    setSeenFinish(finishedKey);
    setIsCollapsing(true);
  }

  useEffect(() => {
    if (!isCollapsing) return;
    const id = setTimeout(() => setIsCollapsing(false), COLLAPSE_VIEW_MS);
    return () => clearTimeout(id);
  }, [isCollapsing]);

  const screen: Screen = isCollapsing ? "game" : session.screen;

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
    screen,
    isCollapsing,
    tower,
    gemini,
    isGenerating,
    canRetryStage,
    retryStage: runStageGeneration,
    currentPlayer,
    isMyTurn,
    loser,
    pullBlock,
  };
}
