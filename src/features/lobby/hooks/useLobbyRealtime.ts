"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import * as mock from "@/lib/api/mock";
import type { Game, GamePlayer } from "@/types/game";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface UseLobbyRealtimeResult {
  game: Game | null;
  players: GamePlayer[];
  isLoading: boolean;
  errorMessage: string | null;
}

/** games / game_players の変更を Realtime で購読し、ロビー画面の状態を返す（DB_DESIGN.md 7章）。 */
export function useLobbyRealtime(gameId: string): UseLobbyRealtimeResult {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
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
      const [gameResult, playersResult] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("game_players").select("*").eq("game_id", gameId),
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
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => {
          void supabase
            .from("game_players")
            .select("*")
            .eq("game_id", gameId)
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
  }, [gameId]);

  return { game, players, isLoading, errorMessage };
}
