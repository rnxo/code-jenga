"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannelSendResponse } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { playSillySound } from "../silly-sounds";
import {
  INITIAL_COOLDOWN,
  SABOTAGE_EVENT,
  SABOTAGE_SCENE_MS,
  canSendSabotage,
  isSabotagePayload,
  markSabotageSent,
  sabotageChannelName,
  type SabotageCooldown,
  type SabotageIncident,
  type SabotagePayload,
} from "../sabotage";

// 妨害（タワー回し）の送受信。担当: FE-B
//
// Supabase Realtime の Broadcast を使う。DB に残さないので、テーブルも API ルートも要らない。
// 盤面の購読（useGameRealtime の game:${id}）とは別チャンネルにする。同名で channel() を
// 呼ぶと supabase-js は同じインスタンスを返し、片方の removeChannel で両方止まってしまう。
//
// このチャンネルは public（Realtime Authorization 未設定）なので、試合の参加者でなくても
// 名前を知っていれば送れる。見た目だけの機能なのでハッカソンの範囲では許容している。

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface UseSabotageResult {
  /** いま画面で進行中の妨害。演出が終わると null に戻る */
  incident: SabotageIncident | null;
  /** 送れる状態か（購読済みで、このターンにまだ送っていない） */
  canSend: boolean;
  /** このターンにもう送ったか（ボタンの文言に使う） */
  usedThisTurn: boolean;
  /** 送信に失敗したときのメッセージ */
  sendError: string | null;
  send: () => Promise<void>;
}

export function useSabotage(gameId: string, currentUserId: string, turnNo: number): UseSabotageResult {
  const [incident, setIncident] = useState<SabotageIncident | null>(null);
  const [isReady, setIsReady] = useState(USE_MOCK);
  const [cooldown, setCooldown] = useState<SabotageCooldown>(INITIAL_COOLDOWN);
  const [sendError, setSendError] = useState<string | null>(null);
  /** 演出の終わりを待つタイマー。次の妨害が来たら前のを取り消す */
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  /** send から参照する。state だと購読の effect を作り直すことになる */
  const sendRef = useRef<((payload: SabotagePayload) => Promise<RealtimeChannelSendResponse>) | null>(null);

  const startIncident = useCallback((seed: number, byMe: boolean) => {
    nextId.current += 1;
    setIncident({ id: nextId.current, seed, byMe });
    // 回される側だけ鳴らす。仕掛けた側の画面ではタワーは回っていない
    if (!byMe) {
      playSillySound("slideUp");
    }
    if (clearTimer.current !== null) {
      clearTimeout(clearTimer.current);
    }
    clearTimer.current = setTimeout(() => {
      clearTimer.current = null;
      setIncident(null);
    }, SABOTAGE_SCENE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimer.current !== null) {
        clearTimeout(clearTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (USE_MOCK) {
      // モックは Supabase に繋がない。send は自分の画面で演出するだけ（下の send 参照）
      sendRef.current = null;
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(sabotageChannelName(gameId), {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: SABOTAGE_EVENT }, (message: { payload?: unknown }) => {
      const payload: unknown = message.payload;
      if (!isSabotagePayload(payload)) {
        console.warn("[sabotage] 形の違う妨害イベントを受け取ったので無視しました", payload);
        return;
      }
      // self: false にしてあるが、保険として自分の送信は無視する
      if (payload.senderId === currentUserId) {
        return;
      }
      startIncident(payload.seed, false);
    });

    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        setIsReady(true);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsReady(false);
        console.error(`[sabotage] Realtime 購読でエラーが発生しました (${status})`, err);
      }
    });

    sendRef.current = (payload) =>
      channel.send({ type: "broadcast", event: SABOTAGE_EVENT, payload });

    return () => {
      sendRef.current = null;
      setIsReady(false);
      void supabase.removeChannel(channel);
    };
  }, [gameId, currentUserId, startIncident]);

  const canSend = isReady && canSendSabotage(cooldown, turnNo);
  const usedThisTurn = !canSendSabotage(cooldown, turnNo);

  const send = useCallback(async () => {
    if (!canSendSabotage(cooldown, turnNo)) {
      return;
    }
    setSendError(null);
    const seed = Math.random();

    if (USE_MOCK) {
      // 相手がいないので自分の画面で回して見せる（動作確認用）
      setCooldown(markSabotageSent(turnNo));
      startIncident(seed, false);
      return;
    }

    const sendFn = sendRef.current;
    if (sendFn === null) {
      setSendError("まだ相手と繋がっていません。少し待ってからもう一度押してください。");
      return;
    }
    const result = await sendFn({ senderId: currentUserId, seed });
    if (result !== "ok") {
      setSendError(`邪魔を送れませんでした（${result}）。もう一度押してください。`);
      return;
    }
    setCooldown(markSabotageSent(turnNo));
    // 仕掛けた側にも「やった」感を出す（タワーは回さず、セリフだけ）
    startIncident(seed, true);
  }, [cooldown, turnNo, currentUserId, startIncident]);

  return { incident, canSend, usedThisTurn, sendError, send };
}
