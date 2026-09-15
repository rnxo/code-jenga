"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import type { Game } from "@/types/game";
import { DogezaPopup } from "./DogezaPopup";
import { ResultDialog } from "./ResultDialog";

// 結果画面の配線。担当: FE-B
// page.tsx（Server Component）からは関数を渡せないため、再戦の呼び出しはここで持つ。
// 見た目は ResultDialog（ようた担当）に任せる。
//
// 再戦の流れ:
//   参加者が「もう一度あそぶ」を押す → 自分だけ次局（waiting）に登録されてロビーへ移る
//   → ロビーでホストを待つ → ホストも同じボタンでロビーへ来て「試合を開始」を押す → 再戦。
// 押していない参加者は結果画面に残ったままなので、勝手にロビーへ引きずり込まれない。

export interface ResultPanelProps {
  game: Game;
  loserNickname: string | null;
  roomCode: string;
  /** rooms.host_id。ホストには「開始はロビーで」の案内を添える。 */
  hostId: string;
  /** 自分の profile id。未サインインなら null。 */
  currentUserId: string | null;
}

export function ResultPanel({
  game,
  loserNickname,
  roomCode,
  hostId,
  currentUserId,
}: ResultPanelProps) {
  const router = useRouter();
  const [isRematching, setIsRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  // 決着直後は自動で開く。閉じたあとも「もう一度見る」で何度でも開ける
  const [isDogezaOpen, setIsDogezaOpen] = useState(true);
  const isHost = currentUserId !== null && currentUserId === hostId;

  async function handleRematch() {
    setIsRematching(true);
    setRematchError(null);

    const result = await apiClient.rematchGame(game.id);

    if (!result.ok) {
      setRematchError(result.error.message);
      setIsRematching(false);
      return;
    }
    // 次局に自分が登録されたので、page.tsx に読み直させてロビーに切り替える。
    // 読み直しても結果画面のままだった場合に押し直せるよう、送信中フラグは戻しておく。
    router.refresh();
    setIsRematching(false);
  }

  return (
    <>
      {/* 決着直後に土下座動画をポップアップで見せる。閉じれば下の結果画面が操作できる */}
      <DogezaPopup
        isOpen={isDogezaOpen}
        onClose={() => setIsDogezaOpen(false)}
      />
      <ResultDialog
        game={game}
        loserNickname={loserNickname}
        roomCode={roomCode}
        onRematch={currentUserId !== null ? handleRematch : undefined}
        rematchUnavailableMessage={
          currentUserId === null ? "サインインすると再戦できます。" : null
        }
        rematchHintMessage={
          isHost
            ? "ロビーで参加者がそろったら「試合を開始」を押してください。"
            : "ロビーでホストが試合を開始するまでお待ちください。"
        }
        isRematching={isRematching}
        rematchErrorMessage={rematchError}
        onReplayDogeza={() => setIsDogezaOpen(true)}
      />
    </>
  );
}
