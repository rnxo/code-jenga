import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameBoard } from "@/features/game";
import { ResultDialog } from "@/features/result";
import { LobbyPanel, type LobbyPlayer } from "@/features/lobby";
import { Spinner } from "@/components/ui/Spinner";
import * as mock from "@/lib/api/mock";
import type { Game, Room } from "@/types/game";

// games.status に応じて ロビー / GameBoard / ResultDialog を出し分けるだけの薄いコンテナ。
//
// 読み込みは Route Handler を経由せず、DB_DESIGN.md 1章の方針どおり
// user-scoped な Supabase クライアント（RLS が効く）で直接 SELECT する。
// 以降のリアルタイム更新は各 feature の useXxxRealtime フックが引き継ぐ。
// NEXT_PUBLIC_USE_MOCK_API=true のときは Supabase を読まず src/lib/api/mock.ts の固定データを使う。
//
// 担当: 共有（変更はチームに宣言してから行うこと）

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

interface RoomPageData {
  userId: string | null;
  room: Room;
  game: Game;
  /** ロビー表示のときだけ埋まる（それ以外は空配列） */
  lobbyPlayers: LobbyPlayer[];
}

async function loadFromSupabase(code: string): Promise<RoomPageData | null> {
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
    return null;
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
    return null;
  }

  let lobbyPlayers: LobbyPlayer[] = [];
  if (game.status === "waiting") {
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
    lobbyPlayers = (gamePlayers ?? []).map((player) => ({
      ...player,
      nickname: nicknameById.get(player.player_id) ?? "(不明なプレイヤー)",
    }));
  }

  return { userId: user?.id ?? null, room, game, lobbyPlayers };
}

function loadFromMock(code: string): RoomPageData | null {
  const data = mock.getRoomPageData(code);
  if (!data) {
    return null;
  }
  return {
    userId: data.userId,
    room: data.room,
    game: data.game,
    lobbyPlayers: data.players.map((player) => ({
      ...player,
      nickname: data.nicknameById.get(player.player_id) ?? "(不明なプレイヤー)",
    })),
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const data = USE_MOCK ? loadFromMock(code) : await loadFromSupabase(code);
  if (!data) {
    notFound();
  }
  const { userId, room, game, lobbyPlayers } = data;

  if (game.status === "waiting" || game.status === "generating") {
    if (game.status === "generating") {
      return (
        <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4">
          <Spinner label="お題を生成中..." />
        </main>
      );
    }

    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-xl font-bold">ロビー（{code}）</h1>
        <LobbyPanel
          game={game}
          players={lobbyPlayers}
          roomCode={code}
          hostId={room.host_id}
          currentUserId={userId}
        />
      </main>
    );
  }

  if (game.status === "playing") {
    if (!userId) {
      notFound();
    }
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <GameBoard gameId={game.id} currentUserId={userId} />
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
