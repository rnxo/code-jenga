import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameBoard } from "@/features/game";
import { ResultDialog } from "@/features/result";
import { PlayerList, type LobbyPlayer } from "@/features/lobby";
import { Spinner } from "@/components/ui/Spinner";

// games.status に応じて ロビー / GameBoard / ResultDialog を出し分けるだけの薄いコンテナ。
//
// 読み込みは Route Handler を経由せず、DB_DESIGN.md 1章の方針どおり
// user-scoped な Supabase クライアント（RLS が効く）で直接 SELECT する。
// 以降のリアルタイム更新は各 feature の useXxxRealtime フックが引き継ぐ。
//
// 担当: 共有（変更はチームに宣言してから行うこと）

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (roomError) {
    throw new Error(`ルーム情報の取得に失敗しました: ${roomError.message}`);
  }
  if (!room) {
    notFound();
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("room_id", room.id)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (gameError) {
    throw new Error(`試合情報の取得に失敗しました: ${gameError.message}`);
  }
  if (!game) {
    notFound();
  }

  if (game.status === "waiting" || game.status === "generating") {
    if (game.status === "generating") {
      return (
        <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4">
          <Spinner label="お題を生成中..." />
        </main>
      );
    }

    const { data: gamePlayers, error: gamePlayersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", game.id);

    if (gamePlayersError) {
      throw new Error(`参加者情報の取得に失敗しました: ${gamePlayersError.message}`);
    }

    const playerIds = (gamePlayers ?? []).map((player) => player.player_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", playerIds);

    if (profilesError) {
      throw new Error(`プレイヤー情報の取得に失敗しました: ${profilesError.message}`);
    }

    const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
    const lobbyPlayers: LobbyPlayer[] = (gamePlayers ?? []).map((player) => ({
      ...player,
      nickname: nicknameById.get(player.player_id) ?? "(不明なプレイヤー)",
    }));

    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-xl font-bold">ロビー（{code}）</h1>
        <PlayerList players={lobbyPlayers} hostId={room.host_id} />
        {/* TODO(FE-A): 準備完了トグル・ホストの「試合開始」ボタン（POST /api/games/[gameId]/start）。 */}
      </main>
    );
  }

  if (game.status === "playing") {
    if (!user) {
      notFound();
    }
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <GameBoard gameId={game.id} currentUserId={user.id} />
      </main>
    );
  }

  // status: 'finished' | 'aborted'
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      {/* TODO(共有): loser_id → nickname の解決（profiles 参照）。 */}
      <ResultDialog game={game} loserNickname={null} roomCode={code} />
    </main>
  );
}
