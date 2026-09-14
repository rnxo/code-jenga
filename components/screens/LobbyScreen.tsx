"use client";

import { Button, ErrorBanner, Panel, Screen } from "@/components/ui";
import { MAX_PLAYERS } from "@/lib/types";
import type { CodeJenga } from "@/hooks/useCodeJenga";

/** ③ 待機画面。Gemini が舞台を作っているあいだの「生成中」もここが兼ねる */
export function LobbyScreen({ game }: { game: CodeJenga }) {
  const { session, gemini, isGenerating } = game;
  const { players, me, isHost, allReady, room } = session;

  return (
    <Screen
      title="待機中"
      subtitle={`合言葉「${room?.password ?? ""}」を伝えると参加できます（${players.length}/${MAX_PLAYERS} 人）`}
    >
      <ErrorBanner message={session.error} onClose={session.clearError} />

      <Panel title="参加者" className="mb-4">
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded bg-neutral-800 px-3 py-2 text-sm"
            >
              <span>
                {player.name}
                {player.is_host && (
                  <span className="ml-2 rounded bg-amber-900 px-1.5 py-0.5 text-[10px] text-amber-100">
                    ホスト
                  </span>
                )}
                {player.id === me?.id && (
                  <span className="ml-2 text-[10px] text-neutral-400">あなた</span>
                )}
              </span>
              <span
                className={`text-xs ${player.is_ready ? "text-emerald-400" : "text-neutral-500"}`}
              >
                {player.is_ready ? "Ready" : "待機中"}
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }).map(
            (_, i) => (
              <li
                key={`empty-${i}`}
                className="rounded border border-dashed border-neutral-800 px-3 py-2 text-sm text-neutral-600"
              >
                空き
              </li>
            ),
          )}
        </ul>
      </Panel>

      {isGenerating ? (
        <div className="rounded-lg border border-indigo-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm font-semibold text-indigo-300">
            🤖 Gemini が舞台を組み立てています...
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-300">
            {gemini.comment || "できあがり次第、全員の画面がコード画面に切り替わります。"}
          </p>
        </div>
      ) : (
      <div className="flex flex-col gap-3">
        <Button
          variant={me?.is_ready ? "secondary" : "success"}
          onClick={session.toggleReady}
        >
          {me?.is_ready ? "Ready を取り消す" : "Ready"}
        </Button>

        {isHost && (
          <Button
            onClick={session.startGame}
            disabled={players.length < 2}
            title={players.length < 2 ? "2人以上集まると開始できます" : ""}
          >
            今すぐ開始
          </Button>
        )}

        <Button variant="danger" onClick={session.leaveRoom}>
          {isHost ? "解散する" : "退出する"}
        </Button>
      </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        {isGenerating
          ? "Gemini が作ったコードが、そのままジェンガのタワーになります。"
          : allReady
          ? "全員 Ready です。まもなく開始します。"
          : isHost
            ? "全員が Ready になると自動で始まります。待たずに始めることもできます。"
            : "ホストが開始するか、全員が Ready になると始まります。"}
      </p>
    </Screen>
  );
}
