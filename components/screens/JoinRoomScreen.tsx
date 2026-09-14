"use client";

import { useState } from "react";
import {
  BackLink,
  Button,
  ErrorBanner,
  ScreenHeader,
  Screen,
  TextField,
} from "@/components/ui";
import { BlockChip } from "@/components/BlockChip";
import type { GameSession } from "@/hooks/useGameSession";

/** ②' 参加する */
export function JoinRoomScreen({ session }: { session: GameSession }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = Boolean(name.trim() && password.trim()) && !session.busy;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="step 01 / guest"
        title="参加する"
        lead="ホストから聞いた合言葉を入れてください。"
      />

      <ErrorBanner message={session.error} onClose={session.clearError} />

      <div className="flex flex-col gap-4">
        <TextField
          label="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="なまえ"
          maxLength={20}
        />

        <TextField
          label="passphrase"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="jenga-123"
          maxLength={40}
          hint="大文字と小文字は区別されます。"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) session.joinRoom(name, password);
          }}
        />
      </div>

      {/* 入れた合言葉がどの積み木になるかを見せる。作る側と同じ絵 */}
      <div className="mt-6 mb-7">
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          the key you were given
        </p>
        <BlockChip text={password} placeholder="合言葉を入れてください" />
      </div>

      <Button
        className="w-full !py-3.5 !text-base"
        disabled={!canSubmit}
        onClick={() => session.joinRoom(name, password)}
      >
        {session.busy ? "参加中..." : "参加する"}
      </Button>

      <BackLink onClick={() => session.goTo("start")} />
    </Screen>
  );
}
