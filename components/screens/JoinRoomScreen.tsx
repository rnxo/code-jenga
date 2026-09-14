"use client";

import { useState } from "react";
import { Button, ErrorBanner, Screen, TextField } from "@/components/ui";
import type { GameSession } from "@/hooks/useGameSession";

/** ②' 参加する */
export function JoinRoomScreen({ session }: { session: GameSession }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Screen title="参加する" subtitle="ホストから聞いた合言葉を入れてください。">
      <ErrorBanner message={session.error} onClose={session.clearError} />

      <div className="flex flex-col gap-4">
        <TextField
          label="あなたの名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player 2"
          maxLength={20}
        />
        <TextField
          label="合言葉"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="jenga123"
          maxLength={40}
        />

        <Button disabled={session.busy} onClick={() => session.joinRoom(name, password)}>
          {session.busy ? "参加中..." : "参加する"}
        </Button>
        <Button variant="secondary" onClick={() => session.goTo("start")}>
          戻る
        </Button>
      </div>
    </Screen>
  );
}
