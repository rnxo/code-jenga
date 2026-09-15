"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/types/game";
import { ResultDialog } from "./ResultDialog";

// 結果画面の配線。担当: FE-B
// page.tsx（Server Component）からは関数を渡せないため、再戦の呼び出しはここで持つ。
// 見た目は ResultDialog（ようた担当）に任せる。

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

export interface ResultPanelProps {
  game: Game;
  loserNickname: string | null;
  roomCode: string;
}

export function ResultPanel({ game, loserNickname, roomCode }: ResultPanelProps) {
  const router = useRouter();
  const [isRematching, setIsRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);

  // 相手が再戦を押したら同じルームに次局（waiting）が INSERT されるので、それを合図に画面を読み直す。
  useEffect(() => {
    if (USE_MOCK) {
      return;
    }
    const supabase = createClient();
    const channel = supabase
      .channel(`room-next-game:${game.room_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "games", filter: `room_id=eq.${game.room_id}` },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [game.room_id, router]);

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
      onRematch={handleRematch}
      isRematching={isRematching}
      rematchErrorMessage={rematchError}
    />
  );
}
