"use client";

import { useState } from "react";
import { Button, ErrorBanner, ScreenHeader, Screen } from "@/components/ui";
import { MAX_PLAYERS } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

/**
 * ③ 待機画面。
 * 人が集まる様子を、そのままタワーが下から積み上がる絵として見せる。
 * Gemini が舞台を作っているあいだの「生成中」もこの画面が兼ねる。
 */
export function LobbyScreen({ game }: { game: CodeJenga }) {
  const { session, gemini, isGenerating } = game;
  const { players, me, isHost, allReady, room } = session;

  const [copied, setCopied] = useState(false);

  const copyPassphrase = async () => {
    if (!room?.password) return;
    try {
      await navigator.clipboard.writeText(room.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 権限が無い環境では何もしない（手で読み上げてもらう）
    }
  };

  const emptySeats = Math.max(0, MAX_PLAYERS - players.length);

  return (
    <Screen>
      <ScreenHeader
        eyebrow={isGenerating ? "step 03 / building" : "step 02 / lobby"}
        title={isGenerating ? "舞台を組み立て中" : "待機中"}
        lead={
          isGenerating
            ? "Gemini が作ったコードが、そのままタワーになります。"
            : "この合言葉を伝えると、同じ部屋に入れます。"
        }
      />

      <ErrorBanner message={session.error} onClose={session.clearError} />

      {/* ②で入れた合言葉が、そのままここに置かれている */}
      {!isGenerating && (
        <div className="mb-7">
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
            passphrase
          </p>
          <button
            onClick={copyPassphrase}
            className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-sm bg-amber-600 px-3 text-left shadow-md shadow-black/40 transition hover:bg-amber-500"
          >
            <span className="shrink-0 font-mono text-[10px] text-black/40">01</span>
            <span className="truncate font-mono text-sm text-black/80">
              {room?.password}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] tracking-[0.15em] text-black/50 uppercase">
              {copied ? "copied" : "copy"}
            </span>
          </button>
        </div>
      )}

      {/* 席＝タワーの段。下から積み上がる */}
      <div className="mb-7">
        <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
          {`seats · ${players.length} / ${MAX_PLAYERS}`}
        </p>

        <div className="flex flex-col-reverse gap-1.5">
          {players.map((player, i) => (
            <div
              key={player.id}
              className={`flex h-11 items-center gap-3 rounded-sm px-3 shadow-md shadow-black/40 transition-colors ${
                player.is_ready ? "bg-amber-600" : "bg-neutral-800"
              }`}
            >
              <span
                className={`shrink-0 font-mono text-[10px] ${
                  player.is_ready ? "text-black/40" : "text-neutral-600"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`truncate text-sm ${
                  player.is_ready ? "text-black/85" : "text-neutral-200"
                }`}
              >
                {player.name}
              </span>
              {player.is_host && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                    player.is_ready
                      ? "bg-black/20 text-black/70"
                      : "bg-amber-900 text-amber-100"
                  }`}
                >
                  ホスト
                </span>
              )}
              {player.id === me?.id && (
                <span
                  className={`shrink-0 text-[10px] ${
                    player.is_ready ? "text-black/50" : "text-neutral-500"
                  }`}
                >
                  あなた
                </span>
              )}
              <span
                className={`ml-auto shrink-0 font-mono text-[10px] tracking-[0.15em] uppercase ${
                  player.is_ready ? "text-black/60" : "text-neutral-600"
                }`}
              >
                {player.is_ready ? "ready" : "waiting"}
              </span>
            </div>
          ))}

          {Array.from({ length: emptySeats }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-11 items-center gap-3 rounded-sm border border-dashed border-neutral-800 px-3"
            >
              <span className="shrink-0 font-mono text-[10px] text-neutral-700">
                {String(players.length + i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm text-neutral-600">空き</span>
            </div>
          ))}
        </div>

        {/* 台 */}
        <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
      </div>

      {isGenerating ? (
        <div className="rounded-lg border border-indigo-900 bg-neutral-900 p-4">
          <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-indigo-300 uppercase">
            gemini is stacking…
          </p>

          {/* 積み上がっていく途中のタワー */}
          <div className="mb-3 flex flex-col-reverse gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-2.5 animate-pulse rounded-sm bg-amber-700/50"
                style={{ animationDelay: `${i * 180}ms`, width: `${72 + i * 6}%` }}
              />
            ))}
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-300">
            {game.canRetryStage
              ? "生成が止まっているようです。誰でも引き取ってやり直せます。"
              : gemini.comment || "できあがり次第、全員の画面が切り替わります。"}
          </p>

          {game.canRetryStage && (
            <Button
              className="mt-3 w-full"
              onClick={game.retryStage}
              disabled={gemini.busy}
            >
              もう一度生成する
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            variant={me?.is_ready ? "secondary" : "success"}
            className="w-full !py-3.5 !text-base"
            onClick={session.toggleReady}
          >
            {me?.is_ready ? "Ready を取り消す" : "Ready"}
          </Button>

          {isHost && (
            <Button
              className="w-full !py-3.5 !text-base"
              onClick={session.startGame}
              disabled={players.length < 2}
              title={players.length < 2 ? "2人以上集まると開始できます" : ""}
            >
              今すぐ開始
            </Button>
          )}

          <button
            onClick={session.leaveRoom}
            className="mt-1 w-full cursor-pointer text-center font-mono text-[11px] tracking-[0.2em] text-red-500/80 uppercase transition hover:text-red-400"
          >
            {isHost ? "× disband" : "× leave"}
          </button>
        </div>
      )}

      {!isGenerating && (
        <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
          {allReady
            ? "全員 Ready です。まもなく始まります。"
            : isHost
              ? "全員が Ready になると自動で始まります。待たずに始めることもできます。"
              : "ホストが開始するか、全員が Ready になると始まります。"}
        </p>
      )}
    </Screen>
  );
}
