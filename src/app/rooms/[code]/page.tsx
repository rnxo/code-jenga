import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GameBoard } from "@/features/game";
import { ResultPanel } from "@/features/result";
import { LobbyPanel, type LobbyPlayer } from "@/features/lobby";
import { Spinner } from "@/components/ui/Spinner";
import * as mock from "@/lib/api/mock";
import type { Game, Room } from "@/types/game";

// games.status に応じて ロビー / GameBoard / ResultPanel を出し分けるだけの薄いコンテナ。
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
  /** 決着後に loser_id を profiles.nickname に解決したもの。敗者なし・未解決なら null */
  loserNickname: string | null;
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

  const { data: latestGame, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("room_id", room.id)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (gameError) {
    throw new Error(`試合情報の取得に失敗しました: ${gameError.message}`);
  }
  if (!latestGame) {
    return null;
  }

  // 再戦のロビー（round_no >= 2 の waiting）は「もう一度あそぶ」を押した人だけの場所。
  // まだ押していない参加者には前局の結果画面を出したままにし、ロビーへ引きずり込まない。
  const game = await resolveVisibleGame(supabase, latestGame, user?.id ?? null);

  let lobbyPlayers: LobbyPlayer[] = [];
  if (game.status === "waiting") {
    // 退室済み（left_at あり）の人はロビーに出さない（#65）
    const { data: gamePlayers, error: gamePlayersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", game.id)
      .is("left_at", null);

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

  let loserNickname: string | null = null;
  if (game.loser_id) {
    const { data: loser, error: loserError } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", game.loser_id)
      .maybeSingle();

    // 名前は飾りに近いので、引けなくても結果画面は出す（null なら「対戦終了」表示に落ちる）。
    if (loserError) {
      console.error(`敗者情報の取得に失敗しました: ${loserError.message}`);
    } else {
      loserNickname = loser?.nickname ?? null;
    }
  }

  return { userId: user?.id ?? null, room, game, lobbyPlayers, loserNickname };
}

/**
 * 再戦ロビー（round_no >= 2, waiting）に自分が登録されていなければ、前局（round_no - 1）を返す。
 * 前局が引けない場合は最新局をそのまま返す（ロビーに入れるだけで害は無い）。
 */
async function resolveVisibleGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  latestGame: Game,
  userId: string | null,
): Promise<Game> {
  if (latestGame.status !== "waiting" || latestGame.round_no <= 1) {
    return latestGame;
  }

  if (userId) {
    const { data: membership, error: membershipError } = await supabase
      .from("game_players")
      .select("player_id")
      .eq("game_id", latestGame.id)
      .eq("player_id", userId)
      .maybeSingle();
    if (membershipError) {
      throw new Error(`参加状況の取得に失敗しました: ${membershipError.message}`);
    }
    if (membership) {
      return latestGame;
    }
  }

  const { data: previousGame, error: previousError } = await supabase
    .from("games")
    .select("*")
    .eq("room_id", latestGame.room_id)
    .eq("round_no", latestGame.round_no - 1)
    .maybeSingle();
  if (previousError) {
    throw new Error(`前局の取得に失敗しました: ${previousError.message}`);
  }
  return previousGame ?? latestGame;
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
    loserNickname: data.game.loser_id ? (data.nicknameById.get(data.game.loser_id) ?? null) : null,
  };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const data = USE_MOCK ? loadFromMock(code) : await loadFromSupabase(code);
  if (!data) {
    notFound();
  }
  const { userId, room, game, lobbyPlayers, loserNickname } = data;

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
    // 盤面はコードの行幅に合わせて広がるので、他の画面より広めに取る。
    // さらに広い画面では、タワーとコードを横に2つ並べるぶんの幅を許す。
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12 xl:max-w-7xl">
        <GameBoard gameId={game.id} currentUserId={userId} />
      </main>
    );
  }

  // status: 'finished' | 'aborted'
  return (
    // 結果画面は縦スクロール無しで収めたいので、上下の余白は控えめにする
    <main className="mx-auto max-w-md px-4 py-6 [@media(max-height:700px)]:py-3">
      <ResultPanel
        game={game}
        loserNickname={loserNickname}
        roomCode={code}
        hostId={room.host_id}
        currentUserId={userId}
      />
    </main>
  );
}
