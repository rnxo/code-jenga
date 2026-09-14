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
import { randomPassphrase } from "@/lib/passphrase";
import { MAX_PLAYERS } from "@/lib/types";
import type { GameSession } from "@/hooks/useGameSession";

/** ② 部屋を作る */
export function CreateRoomScreen({ session }: { session: GameSession }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = Boolean(name.trim() && password.trim()) && !session.busy;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="step 01 / host"
        title="部屋を作る"
        lead={`合言葉を決めて、あとの ${MAX_PLAYERS - 1} 人に伝えてください。`}
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
          hint="この文字列を知っている人だけが入れます。秘密の情報としては扱っていません。"
          trailing={
            <button
              type="button"
              onClick={() => setPassword(randomPassphrase())}
              title="ランダムに決める"
              className="cursor-pointer rounded px-2 py-1.5 text-base transition hover:bg-neutral-800"
            >
              🎲
            </button>
          }
        />
      </div>

      {/* 合言葉を積み木1個として見せて、スタート画面と地続きにする */}
      <div className="mt-6 mb-6">
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          this is your key
        </p>
        <BlockChip text={password} placeholder="合言葉を入れてください" />
      </div>

      {/* 何人入れるかは、席をそのまま並べて見せる */}
      <div className="mb-7">
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          {`seats · 1 / ${MAX_PLAYERS}`}
        </p>
        <div className="flex gap-1.5">
          <div className="flex h-9 flex-1 items-center rounded-sm bg-amber-600 px-2.5 text-[11px] text-black/80">
            <span className="truncate">{name.trim() || "あなた"}</span>
          </div>
          {Array.from({ length: MAX_PLAYERS - 1 }).map((_, i) => (
            <div
              key={i}
              className="flex h-9 flex-1 items-center rounded-sm border border-dashed border-neutral-800 px-2.5 text-[11px] text-neutral-600"
            >
              空き
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full !py-3.5 !text-base"
        disabled={!canSubmit}
        onClick={() => session.createRoom(name, password)}
      >
        {session.busy ? "作成中..." : "作成して待機する"}
      </Button>

      <BackLink onClick={() => session.goTo("start")} />
    </Screen>
  );
}
