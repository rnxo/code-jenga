"use client";

import { useState } from "react";
import { Button, ErrorBanner, Screen, TextField } from "@/components/ui";
import { MAX_PLAYERS } from "@/lib/types";
import type { GameSession } from "@/hooks/useGameSession";

/** ② 部屋を作る */
export function CreateRoomScreen({ session }: { session: GameSession }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Screen title="部屋を作る" subtitle={`ホストを含めて最大 ${MAX_PLAYERS} 人です。`}>
      <ErrorBanner message={session.error} onClose={session.clearError} />

      <div className="flex flex-col gap-4">
        <TextField
          label="あなたの名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player 1"
          maxLength={20}
        />
        <TextField
          label="合言葉（参加者に伝えてください）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="jenga123"
          maxLength={40}
        />

        <Button
          disabled={session.busy}
          onClick={() => session.createRoom(name, password)}
        >
          {session.busy ? "作成中..." : "作成して待機する"}
        </Button>
        <Button variant="secondary" onClick={() => session.goTo("start")}>
          戻る
        </Button>
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        合言葉は秘密の情報として扱っていません。パスワードの使い回しは避けてください。
      </p>
    </Screen>
  );
}
