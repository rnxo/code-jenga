"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import * as mock from "@/lib/api/mock";
import type { Game, Turn } from "@/types/game";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface UseGameRealtimeResult {
  game: Game | null;
  turns: Turn[];
  isLoading: boolean;
  errorMessage: string | null;
}

/** games / turns の変更を Realtime で購読し、盤面の状態を返す（DB_DESIGN.md 7章）。 */
export function useGameRealtime(gameId: string): UseGameRealtimeResult {
  const [game, setGame] = useState<Game | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // モック時は Supabase に繋がず固定データを返す（Realtime 更新は無い）。
    // SSR と同じ「読み込み中」から始めてクライアントで埋めることで hydration のズレを避ける。
    if (USE_MOCK) {
      const timer = setTimeout(() => {
        setGame(mock.getGameById(gameId));
        setTurns(mock.getTurnsByGameId(gameId));
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    const supabase = createClient();
    let isMounted = true;

    async function loadInitialState() {
      const [gameResult, turnsResult] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase
          .from("turns")
          .select("*")
          .eq("game_id", gameId)
          .order("turn_no", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      if (gameResult.error) {
        setErrorMessage(`試合情報の取得に失敗しました: ${gameResult.error.message}`);
      } else {
        setGame(gameResult.data);
      }

      if (turnsResult.error) {
        setErrorMessage(`手番履歴の取得に失敗しました: ${turnsResult.error.message}`);
      } else {
        setTurns(turnsResult.data ?? []);
      }

      setIsLoading(false);
    }

    void loadInitialState();

    const channel = supabase
      .channel(`game:${gameId}`)
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
        { event: "INSERT", schema: "public", table: "turns", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setTurns((prev) => [...prev, payload.new as Turn]);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, turns, isLoading, errorMessage };
}
