"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import type { Game } from "@/types/game";
import { useRematchRealtime } from "../hooks/useRematchRealtime";
import { ResultDialog } from "./ResultDialog";

// 結果画面の配線。担当: FE-B
// page.tsx（Server Component）からは関数を渡せないため、再戦の呼び出しはここで持つ。
// 見た目は ResultDialog（ようた担当）に任せる。
// 再戦を始められるのはホストだけ。他の参加者は、ホストの再戦で自分が次局に
// コピーされたのを Realtime で検知してロビーへ移る（useRematchRealtime）。

export interface ResultPanelProps {
  game: Game;
  loserNickname: string | null;
  roomCode: string;
  /** rooms.host_id。再戦ボタンはホストにだけ出す。 */
  hostId: string;
  /** 自分の profile id。未サインインなら null。 */
  currentUserId: string | null;
}

export function ResultPanel({ game, loserNickname, roomCode, hostId, currentUserId }: ResultPanelProps) {
  const router = useRouter();
  const [isRematching, setIsRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const isHost = currentUserId !== null && currentUserId === hostId;

  // 次局の games INSERT は参加者コピー前で RLS に弾かれるため、自分の game_players INSERT を合図にする。
  useRematchRealtime(currentUserId);

  async function handleRematch() {
    setIsRematching(true);
    setRematchError(null);

    const result = await apiClient.rematchGame(game.id);

    if (!result.ok) {
      setRematchError(result.error.message);
      setIsRematching(false);
      return;
    }
    // 次局が waiting で作られたので、page.tsx に読み直させてロビーに切り替える。
    // 読み直しても結果画面のままだった場合に押し直せるよう、送信中フラグは戻しておく。
    router.refresh();
    setIsRematching(false);
  }

  return (
    <ResultDialog
      game={game}
      loserNickname={loserNickname}
      roomCode={roomCode}
      onRematch={isHost ? handleRematch : undefined}
      rematchUnavailableMessage={isHost ? null : "ホストが再戦を始めると、自動でロビーに移動します。"}
      isRematching={isRematching}
      rematchErrorMessage={rematchError}
    />
  );
}
