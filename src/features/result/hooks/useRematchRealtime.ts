"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

/**
 * 再戦で次局が作られたことを検知し、サーバー側の描画を取り直してロビーへ遷移させる。
 *
 * 次局の games INSERT は、その時点ではまだ game_players がコピーされておらず
 * RLS（is_game_participant）に弾かれて届かない。代わりに「自分が次局の game_players に
 * コピーされた INSERT」を購読する。この行自体が自分を参加者にするので RLS を通過する。
 */
export function useRematchRealtime(currentUserId: string | null): void {
  const router = useRouter();

  useEffect(() => {
    if (USE_MOCK || currentUserId === null) {
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const channel = supabase
      .channel(`rematch:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_players", filter: `player_id=eq.${currentUserId}` },
        () => {
          router.refresh();
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
  }, [currentUserId, router]);
}
