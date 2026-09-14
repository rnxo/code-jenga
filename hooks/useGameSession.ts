"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { MAX_PLAYERS, type Player, type Room, type Screen, type Verdict } from "@/lib/types";
import {
  getIdentitySnapshot,
  getServerIdentitySnapshot,
  setIdentity as persistIdentity,
  subscribe as subscribeIdentity,
  type Identity,
} from "@/lib/identityStore";

/** ①スタート内での行き先。部屋に入ったあとは room.phase が画面を決める */
type Nav = "start" | "create" | "join";

function newId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface GameSession {
  /** いま表示すべき画面 */
  screen: Screen;
  room: Room | null;
  /** 参加順に並んだプレイヤー */
  players: Player[];
  /** 自分 */
  me: Player | null;
  isHost: boolean;
  /** 満室かどうか */
  isFull: boolean;
  /** 全員 Ready かどうか */
  allReady: boolean;
  /** 部屋に入っていない状態で、全端末同期が効くか */
  isSyncedRemotely: boolean;
  /** 直近の操作エラー。UI で出したら clearError() を呼ぶ */
  error: string | null;
  clearError: () => void;
  busy: boolean;

  goTo: (nav: Nav) => void;
  createRoom: (playerName: string, password: string) => Promise<void>;
  joinRoom: (playerName: string, password: string) => Promise<void>;
  toggleReady: () => Promise<void>;
  /** ホストが待たずに開始する。まず Gemini の生成待ちに入る */
  startGame: () => Promise<void>;
  /** 生成が終わったら舞台名を記録して本番へ */
  beginPlaying: (params: { stageTitle: string; comment: string }) => Promise<void>;
  /** 1手進める */
  advanceTurn: () => Promise<void>;
  /** 実行結果を部屋に記録する。崩れていたらそのまま終了画面へ */
  recordRun: (params: {
    output: string;
    collapsed: boolean;
    loserId: string | null;
  }) => Promise<void>;
  /** Gemini の講評を部屋に記録し、全員の画面に出す */
  recordJudge: (params: { verdict: Verdict | null; comment: string }) => Promise<void>;
  /** 「このまま」= 同じメンバーでもう一戦 */
  playAgain: () => Promise<void>;
  /** 「解散」= ホストなら部屋ごと、そうでなければ自分だけ抜ける */
  leaveRoom: () => Promise<void>;
}

export function useGameSession(): GameSession {
  const identity = useSyncExternalStore(
    subscribeIdentity,
    getIdentitySnapshot,
    getServerIdentitySnapshot,
  );
  const [nav, setNav] = useState<Nav>("start");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyIdentity = useCallback((next: Identity | null) => {
    persistIdentity(next);
    if (!next) {
      setRoom(null);
      setPlayers([]);
      setNav("start");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!identity) return;

    const { data: roomRow } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", identity.roomId)
      .maybeSingle();

    if (!roomRow) {
      // ホストが解散した、あるいは部屋が消えた
      applyIdentity(null);
      setError("部屋が解散されました");
      return;
    }

    const { data: playerRows } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", identity.roomId)
      .order("created_at", { ascending: true });

    setRoom(roomRow as Room);
    setPlayers((playerRows ?? []) as Player[]);
  }, [identity, applyIdentity]);

  // 部屋とプレイヤーの変更を購読する
  useEffect(() => {
    if (!identity) return;

    const channel = supabase
      .channel(`room_${identity.roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () =>
        refresh(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () =>
        refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [identity, refresh]);

  const me = useMemo(
    () => players.find((p) => p.id === identity?.playerId) ?? null,
    [players, identity],
  );
  const isHost = Boolean(me?.is_host);
  const isFull = players.length >= MAX_PLAYERS;
  const allReady = players.length >= 2 && players.every((p) => p.is_ready);

  const createRoom = useCallback(
    async (playerName: string, password: string) => {
      if (!password.trim()) return setError("合言葉を入力してください");
      if (!playerName.trim()) return setError("名前を入力してください");

      setBusy(true);
      const roomId = newId();
      const playerId = newId();

      const { error: roomError } = await supabase.from("rooms").insert([
        { id: roomId, password: password.trim(), host_id: playerId, phase: "lobby" },
      ]);

      if (roomError) {
        setBusy(false);
        return setError(
          `部屋を作れませんでした（同じ合言葉の部屋が既にあるかもしれません）: ${roomError.message}`,
        );
      }

      const { error: playerError } = await supabase.from("players").insert([
        {
          id: playerId,
          room_id: roomId,
          name: playerName.trim(),
          is_host: true,
          is_ready: false,
        },
      ]);

      setBusy(false);
      if (playerError) return setError(`参加に失敗しました: ${playerError.message}`);

      applyIdentity({ roomId, playerId });
    },
    [applyIdentity],
  );

  const joinRoom = useCallback(
    async (playerName: string, password: string) => {
      if (!password.trim()) return setError("合言葉を入力してください");
      if (!playerName.trim()) return setError("名前を入力してください");

      setBusy(true);

      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("password", password.trim())
        .eq("phase", "lobby")
        .maybeSingle();

      if (!roomRow) {
        setBusy(false);
        return setError("その合言葉の部屋は見つかりませんでした（もう始まっているかも）");
      }

      const { data: existing } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", (roomRow as Room).id)
        .order("created_at", { ascending: true });

      if ((existing?.length ?? 0) >= MAX_PLAYERS) {
        setBusy(false);
        return setError(`満室です（最大 ${MAX_PLAYERS} 人）`);
      }

      const playerId = newId();
      const { error: playerError } = await supabase.from("players").insert([
        {
          id: playerId,
          room_id: (roomRow as Room).id,
          name: playerName.trim(),
          is_host: false,
          is_ready: false,
        },
      ]);

      setBusy(false);
      if (playerError) return setError(`参加に失敗しました: ${playerError.message}`);

      applyIdentity({ roomId: (roomRow as Room).id, playerId });
    },
    [applyIdentity],
  );

  const toggleReady = useCallback(async () => {
    if (!me) return;
    await supabase.from("players").update({ is_ready: !me.is_ready }).eq("id", me.id);
    await refresh();
  }, [me, refresh]);

  const startGame = useCallback(async () => {
    if (!room) return;
    if (players.length < 2) return setError("2人以上集まると開始できます");
    // 本番の前に、Gemini が舞台を作るあいだの待機に入る
    await supabase.from("rooms").update({ phase: "generating" }).eq("id", room.id);
    await refresh();
  }, [room, players, refresh]);

  const beginPlaying = useCallback(
    async ({ stageTitle, comment }: { stageTitle: string; comment: string }) => {
      if (!room) return;
      await supabase
        .from("rooms")
        .update({
          phase: "playing",
          stage_title: stageTitle,
          judge_comment: comment,
          turn_index: 0,
          last_output: null,
          verdict: null,
          loser_id: null,
        })
        .eq("id", room.id);
      await refresh();
    },
    [room, refresh],
  );

  const advanceTurn = useCallback(async () => {
    if (!room) return;
    await supabase
      .from("rooms")
      .update({ turn_index: (room.turn_index ?? 0) + 1 })
      .eq("id", room.id);
    await refresh();
  }, [room, refresh]);

  // 全員 Ready になったらホストの端末が開始させる（同時更新を避けるため1台だけ）
  useEffect(() => {
    if (!room || room.phase !== "lobby" || !isHost || !allReady) return;
    supabase
      .from("rooms")
      .update({ phase: "generating" })
      .eq("id", room.id)
      .then(() => refresh());
  }, [room, isHost, allReady, refresh]);

  const recordRun = useCallback(
    async ({
      output,
      collapsed,
      loserId,
    }: {
      output: string;
      collapsed: boolean;
      loserId: string | null;
    }) => {
      if (!room || room.phase === "finished") return;

      await supabase
        .from("rooms")
        .update({
          last_output: output,
          // 崩れていなければ次の一手へ、崩れたら決着
          ...(collapsed ? { phase: "finished", loser_id: loserId } : {}),
        })
        .eq("id", room.id);

      await refresh();
    },
    [room, refresh],
  );

  const recordJudge = useCallback(
    async ({ verdict, comment }: { verdict: Verdict | null; comment: string }) => {
      if (!room) return;
      await supabase
        .from("rooms")
        .update({ verdict, judge_comment: comment })
        .eq("id", room.id);
      await refresh();
    },
    [room, refresh],
  );

  const playAgain = useCallback(async () => {
    if (!room) return;
    await supabase.from("jenga_blocks").delete().eq("room_id", room.id);
    await Promise.all(
      players.map((p) =>
        supabase.from("players").update({ is_ready: false }).eq("id", p.id),
      ),
    );
    await supabase
      .from("rooms")
      .update({
        phase: "lobby",
        loser_id: null,
        last_output: null,
        verdict: null,
        judge_comment: null,
        stage_title: null,
        turn_index: 0,
      })
      .eq("id", room.id);
    await refresh();
  }, [room, players, refresh]);

  const leaveRoom = useCallback(async () => {
    if (!room || !me) return applyIdentity(null);

    if (me.is_host) {
      // ホストが抜けたら部屋ごと畳む
      await supabase.from("jenga_blocks").delete().eq("room_id", room.id);
      await Promise.all(
        players.map((p) => supabase.from("players").delete().eq("id", p.id)),
      );
      await supabase.from("rooms").delete().eq("id", room.id);
    } else {
      await supabase.from("players").delete().eq("id", me.id);
    }

    applyIdentity(null);
  }, [room, me, players, applyIdentity]);

  const screen: Screen = useMemo(() => {
    if (!identity || !room) return nav;
    if (room.phase === "playing") return "game";
    if (room.phase === "finished") return "result";
    // "generating" は待機画面が「生成中」として兼ねる
    return "lobby";
  }, [identity, room, nav]);

  return {
    screen,
    room,
    players,
    me,
    isHost,
    isFull,
    allReady,
    isSyncedRemotely: isSupabaseConfigured,
    error,
    clearError: () => setError(null),
    busy,
    goTo: setNav,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    beginPlaying,
    advanceTurn,
    recordRun,
    recordJudge,
    playAgain,
    leaveRoom,
  };
}
