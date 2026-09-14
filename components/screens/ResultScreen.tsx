"use client";

import { Button, ErrorBanner, Panel, Screen } from "@/components/ui";
import type { CodeJenga } from "@/hooks/useCodeJenga";

/** ⑤ 終了画面 */
export function ResultScreen({ game }: { game: CodeJenga }) {
  const { session, tower, loser } = game;
  const room = session.room;

  return (
    <Screen
      title="🧨 タワー崩壊"
      subtitle={
        loser
          ? `${loser.name} さんの一手で崩れました。`
          : "決着しました。"
      }
    >
      <ErrorBanner message={session.error} onClose={session.clearError} />

      <Panel title="最後の実行結果" className="mb-4">
        <pre className="max-h-48 overflow-y-auto font-mono text-[13px] whitespace-pre-wrap text-emerald-400">
          {room?.last_output ?? tower.output ?? "(出力なし)"}
        </pre>
      </Panel>

      {room?.judge_comment && (
        <Panel title="🤖 Gemini の講評" accent className="mb-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-200">
            {room.judge_comment}
          </p>
        </Panel>
      )}

      <Panel title={`積み上がった ${tower.blocks.length} ブロック`} className="mb-4">
        <ol className="flex flex-col gap-1 font-mono text-[12px] text-neutral-300">
          {tower.blocks.map((block) => (
            <li key={block.id} className="truncate">
              <span className="mr-2 text-neutral-500">{block.player_name}</span>
              {block.code_snippet}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex flex-col gap-3">
        {session.isHost && <Button onClick={session.playAgain}>このまま もう一戦</Button>}
        <Button variant="danger" onClick={session.leaveRoom}>
          {session.isHost ? "解散する" : "退出する"}
        </Button>
      </div>

      {!session.isHost && (
        <p className="mt-6 text-xs text-neutral-500">
          ホストが「もう一戦」を選ぶと待機画面に戻ります。
        </p>
      )}
    </Screen>
  );
}
