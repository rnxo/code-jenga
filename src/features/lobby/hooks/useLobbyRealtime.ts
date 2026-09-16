"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import * as mock from "@/lib/api/mock";
import type { Game, GamePlayer, Room } from "@/types/game";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface UseLobbyRealtimeResult {
  game: Game | null;
  players: GamePlayer[];
  /** rooms.host_id の最新値。ホスト離脱による委譲を反映する。未取得なら null */
  hostId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
}

/** games / game_players / rooms の変更を Realtime で購読し、ロビー画面の状態を返す（DB_DESIGN.md 7章）。 */
export function useLobbyRealtime(gameId: string, roomId: string): UseLobbyRealtimeResult {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // モック時は Supabase に繋がず固定データを返す（Realtime 更新は無い）。
    // SSR と同じ「読み込み中」から始めてクライアントで埋めることで hydration のズレを避ける。
    if (USE_MOCK) {
      const timer = setTimeout(() => {
        setGame(mock.getGameById(gameId));
        setPlayers(mock.getPlayersByGameId(gameId));
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const supabase = createClient();
    let isMounted = true;

    async function loadInitialState() {
      const [gameResult, playersResult, roomResult] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        // 退室は行を消さず left_at を入れる方式なので、在室中の人だけに絞る（#65）
        supabase.from("game_players").select("*").eq("game_id", gameId).is("left_at", null),
        supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle(),
      ]);

      if (!isMounted) {
        return;
      }

      if (gameResult.error) {
        setErrorMessage(`試合情報の取得に失敗しました: ${gameResult.error.message}`);
      } else {
        setGame(gameResult.data);
      }

      if (playersResult.error) {
        setErrorMessage(`参加者情報の取得に失敗しました: ${playersResult.error.message}`);
      } else {
        setPlayers(playersResult.data ?? []);
      }

      if (roomResult.error) {
        // ホスト表示は SSR で渡された値にフォールバックできるので、エラーはログに留める。
        console.error(`ルーム情報の取得に失敗しました: ${roomResult.error.message}`);
      } else if (roomResult.data) {
        setHostId(roomResult.data.host_id);
      }

      setIsLoading(false);
    }

    void loadInitialState();

    // RLS が効くテーブルの Realtime は購読時の JWT でポリシーが評価されるため、
    // セッション復元前に subscribe すると anon 扱いになりイベントが届かない。
    // 先にセッションを取得して Realtime に JWT を渡してから購読する（useGameRealtime と同じ）。
    const channel = supabase
      .channel(`lobby:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            return;
          }
          setGame(payload.new as Game);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          // ホスト離脱時に leaveGame が rooms.host_id を書き換える。それを全員が受け取ってボタン表示を切り替える。
          setHostId((payload.new as Room).host_id);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => {
          void supabase
            .from("game_players")
            .select("*")
            .eq("game_id", gameId)
            .is("left_at", null)
            .then(({ data }) => {
              if (isMounted && data) {
                setPlayers(data);
              }
            });
        },
      );

    async function subscribeWithAuth() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.error(`Realtime 購読前のセッション取得に失敗しました: ${error.message}`);
      }
      if (!isMounted) {
        return;
      }
      await supabase.realtime.setAuth(session?.access_token);
      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Realtime 購読でエラーが発生しました (${status})`, err);
        }
      });
    }

    void subscribeWithAuth();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [gameId, roomId]);

  return { game, players, hostId, isLoading, errorMessage };
}
