"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CodeLanguage, Game } from "@/types/game";
import { LANGUAGE_LABEL } from "@/lib/shared/language";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { LeaveButton } from "@/components/ui/LeaveButton";
import { createClient } from "@/lib/supabase/client";
import { useLobbyRealtime } from "../hooks/useLobbyRealtime";
import { LanguageSelector } from "./LanguageSelector";
import { PlayerList, type LobbyPlayer } from "./PlayerList";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface LobbyPanelProps {
  game: Game;
  players: LobbyPlayer[];
  roomCode: string;
  hostId: string;
  currentUserId: string | null;
  /** rooms.max_players。渡すと空き枠も段として見せる */
  maxPlayers?: number;
  /** 何人そろえば開始できるか */
  minPlayers?: number;
}

export function LobbyPanel({
  game: initialGame,
  players: initialPlayers,
  roomCode,
  hostId,
  currentUserId,
  maxPlayers,
  minPlayers = 2,
}: LobbyPanelProps) {
  const router = useRouter();
  const { game: liveGame, players: livePlayers, isLoading, errorMessage } = useLobbyRealtime(initialGame.id);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);
  // モック時は Realtime が無いので、API が返した game をここで保持して見た目を切り替える。
  const [mockGameOverride, setMockGameOverride] = useState<Game | null>(null);
  const [nicknameById, setNicknameById] = useState(
    () => new Map(initialPlayers.map((player) => [player.player_id, player.nickname])),
  );
  const game = mockGameOverride ?? liveGame ?? initialGame;
  const players = (isLoading ? initialPlayers : livePlayers).map((player) => ({
    ...player,
    nickname: nicknameById.get(player.player_id) ?? "(参加者)",
  }));
  const isHost = currentUserId === hostId;
  // サーバー側の人数チェックはまだ無いので、足りないうちは押せないようにする
  const hasEnoughPlayers = players.length >= minPlayers;

  useEffect(() => {
    // モック時は profiles を引かない（nicknameById は initialPlayers から seed 済み）。
    if (USE_MOCK) {
      return;
    }

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

  // 退出は startGame と同じくこの中で API を呼ぶ（page.tsx からは関数を渡せないため）。
  async function handleLeave() {
    setIsLeaving(true);
    setLeaveError(null);
    const result = await apiClient.leaveGame(initialGame.id);
    if (!result.ok) {
      setLeaveError(result.error.message);
      setIsLeaving(false);
      return;
    }
    router.push("/");
  }

  // 言語の変更はホストだけが行い、結果は games の UPDATE を Realtime で全員が受け取る。
  // 楽観更新はしない（サーバーが真実。失敗したら元の表示のまま理由を出す）。
  async function handleChangeLanguage(next: CodeLanguage) {
    if (next === game.language || isUpdatingLanguage) {
      return;
    }
    setIsUpdatingLanguage(true);
    setLanguageError(null);
    const result = await apiClient.updateGameLanguage(initialGame.id, { language: next });
    if (!result.ok) {
      setLanguageError(result.error.message);
    } else if (USE_MOCK) {
      setMockGameOverride(result.data.game);
    }
    setIsUpdatingLanguage(false);
  }

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

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setIsCodeCopied(true);
      window.setTimeout(() => setIsCodeCopied(false), 1600);
    } catch {
      // 権限が無い環境では何もしない（画面に出ているコードを読み上げてもらう）
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
          lobby
        </p>
        <h2 className="text-xl font-bold">待機中</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          このルームコードを伝えると入室できます。
        </p>
      </header>

      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}

      {/* 口頭で伝えるものなので、一番大きく出して押すだけでコピーできるようにする */}
      <div>
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
          room code
        </p>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-sm bg-amber-600 px-4 text-left shadow-sm transition hover:bg-amber-500"
        >
          <span className="flex-1 font-mono text-2xl tracking-[0.3em] text-black/85">
            {roomCode}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-[0.15em] text-black/50 uppercase">
            {isCodeCopied ? "copied" : "copy"}
          </span>
        </button>
      </div>

      <LanguageSelector
        language={game.language}
        isHost={isHost}
        disabled={isUpdatingLanguage || isStarting || game.status !== "waiting"}
        onChange={handleChangeLanguage}
        errorMessage={languageError}
      />

      <PlayerList players={players} hostId={hostId} maxPlayers={maxPlayers} />

      {isHost ? (
        <div className="flex flex-col gap-2">
          {startError ? (
            <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {startError}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            onClick={handleStart}
            disabled={isStarting || game.status !== "waiting" || !hasEnoughPlayers}
          >
            {isStarting ? "開始中..." : "試合を開始"}
          </Button>

          <p className="text-center text-xs text-gray-500">
            {hasEnoughPlayers
              ? `${LANGUAGE_LABEL[game.language]} で開始できます。`
              : `あと ${minPlayers - players.length} 人そろうと開始できます。`}
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500">
          ホストが試合を開始するまでお待ちください。
        </p>
      )}

      {/* 退出は主要な動線ではないので、開始ボタンより下に控えめに置く */}
      {leaveError ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {leaveError}
        </p>
      ) : null}
      <LeaveButton onLeave={handleLeave} isLeaving={isLeaving} />
    </div>
  );
}
