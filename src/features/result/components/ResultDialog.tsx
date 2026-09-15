"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Game } from "@/types/game";

// 敗者表示＋再戦ボタン。担当: FE-B

export interface ResultDialogProps {
  game: Game;
  /** loser_id に対応する表示名（TODO: profiles との JOIN 結果を呼び出し側で渡す） */
  loserNickname: string | null;
  roomCode: string;
}

// TODO(FE-B): 「再戦」ボタンから再戦フロー（DB_DESIGN.md 5章-6）を呼び出す。
export function ResultDialog({ game, loserNickname, roomCode }: ResultDialogProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 p-6 text-center">
      <h2 className="text-lg font-bold">
        {loserNickname ? `${loserNickname} の負け！` : "対戦終了"}
      </h2>
      <p className="text-sm text-gray-600">終了理由: {game.finish_reason ?? "-"}</p>
      <Button onClick={() => router.push(`/rooms/${roomCode}`)}>ロビーに戻る（再戦）</Button>
    </div>
  );
}
