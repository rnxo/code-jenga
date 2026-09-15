"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/types/game";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { PlayerList, type LobbyPlayer } from "./PlayerList";

export interface LobbyPanelProps {
  game: Game;
  players: LobbyPlayer[];
  roomCode: string;
  hostId: string;
  currentUserId: string | null;
}

export function LobbyPanel({
  game: initialGame,
  players: initialPlayers,
  roomCode,
  hostId,
  currentUserId,
}: LobbyPanelProps) {
  const router = useRouter();
  const { game: liveGame, players: livePlayers, isLoading, errorMessage } = useLobbyRealtime(initialGame.id);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [nicknameById, setNicknameById] = useState(
    () => new Map(initialPlayers.map((player) => [player.player_id, player.nickname])),
  );
  const game = liveGame ?? initialGame;
  const players = (isLoading ? initialPlayers : livePlayers).map((player) => ({
    ...player,
    nickname: nicknameById.get(player.player_id) ?? "(参加者)",
  }));
  const isHost = currentUserId === hostId;

  useEffect(() => {
    const playerIds = livePlayers.map((player) => player.player_id);
    if (playerIds.length === 0) {
      return;
    }

    let isMounted = true;
    void createClient()
      .from("profiles")
      .select("id, nickname")
      .in("id", playerIds)
      .then(({ data }) => {
        if (!isMounted || !data) {
          return;
        }
        setNicknameById((current) => {
          const next = new Map(current);
          for (const profile of data) {
            next.set(profile.id, profile.nickname);
          }
          return next;
        });
      });

    return () => {
      isMounted = false;
    };
  }, [livePlayers]);

  useEffect(() => {
    if (game.status === "playing") {
      router.refresh();
    }
  }, [game.status, router]);

  async function handleStart() {
    setIsStarting(true);
    setStartError(null);
    const result = await apiClient.startGame(initialGame.id, {
      turnTimeLimitSeconds: initialGame.turn_time_limit_seconds,
    });
    if (!result.ok) {
      setStartError(result.error.message);
      setIsStarting(false);
      return;
    }
    // Realtime の games UPDATE を待たずにサーバー側の描画を取り直し、ホストは即座に盤面へ遷移する。
    router.refresh();
  }

  if (isLoading && !liveGame) {
    return <Spinner label="ロビーを読み込み中..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <PlayerList players={players} hostId={hostId} />
      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={handleStart} disabled={isStarting || game.status !== "waiting"}>
            {isStarting ? "開始中..." : "試合を開始"}
          </Button>
          {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500">ホストが試合を開始するまでお待ちください。</p>
      )}
      <p className="text-center text-xs text-gray-500">ルームコード: {roomCode}</p>
    </div>
  );
}
