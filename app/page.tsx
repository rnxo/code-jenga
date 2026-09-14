"use client";

import { useCodeJenga } from "@/hooks/useCodeJenga";
import { StartScreen } from "@/components/screens/StartScreen";
import { CreateRoomScreen } from "@/components/screens/CreateRoomScreen";
import { JoinRoomScreen } from "@/components/screens/JoinRoomScreen";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { GameScreen } from "@/components/screens/GameScreen";
import { ResultScreen } from "@/components/screens/ResultScreen";

// 画面遷移：①スタート → ②部屋作成/参加 → ③待機 → ④コード → ⑤終了
// どの画面を出すかは useGameSession が持つ room.phase から決まるので、
// ここは振り分けるだけです。
export default function CodeJengaPage() {
  const game = useCodeJenga();

  switch (game.session.screen) {
    case "create":
      return <CreateRoomScreen session={game.session} />;
    case "join":
      return <JoinRoomScreen session={game.session} />;
    case "lobby":
      return <LobbyScreen game={game} />;
    case "game":
      return <GameScreen game={game} />;
    case "result":
      return <ResultScreen game={game} />;
    default:
      return <StartScreen session={game.session} />;
  }
}
