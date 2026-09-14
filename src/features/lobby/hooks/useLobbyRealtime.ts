"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, GamePlayer } from "@/types/game";

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
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, players, isLoading, errorMessage };
}
