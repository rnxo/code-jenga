"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { JengaTower } from "@/features/game";
import type { Game, GameFinishReason } from "@/types/game";

// 敗者表示＋再戦ボタン。担当: FE-B
//
// 決着したあとの盤面なので、最後のコードを「崩れたタワー」として見せる。
// games.current_code がそのまま残っているので、追加のデータ取得は要らない。

export interface ResultDialogProps {
  game: Game;
  /** loser_id に対応する表示名（TODO: profiles との JOIN 結果を呼び出し側で渡す） */
  loserNickname: string | null;
  roomCode: string;
}

const FINISH_REASON: Record<GameFinishReason, string> = {
  test_failed: "テストが落ちて崩壊",
  timeout: "時間切れ",
  no_lines_left: "抜ける行が無くなった",
  aborted: "中断",
};

export function ResultDialog({ game, loserNickname, roomCode }: ResultDialogProps) {
  const router = useRouter();

  // 抜ける行が無くなった場合は「全員が最後まで崩さなかった」ので敗者は出ない
  const hasLoser = game.loser_id !== null && game.finish_reason !== "no_lines_left";
  const reasonLabel = game.finish_reason ? FINISH_REASON[game.finish_reason] : null;
  const code = game.current_code ?? "";

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
          result
        </p>
        <h2
          className={`text-2xl font-bold ${
            hasLoser ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hasLoser ? "タワー崩壊" : "対戦終了"}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {hasLoser
            ? `${loserNickname ?? "崩したプレイヤー"} の負けです。`
            : "最後まで崩れませんでした。"}
        </p>
      </header>

      <div className="rounded-lg border border-gray-200 px-4 py-3 text-center dark:border-gray-800">
        <p className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
          finish reason
        </p>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{reasonLabel ?? "-"}</p>
      </div>

      {/* 崩れたタワー。最後のコードをそのまま倒して見せる */}
      {code.length > 0 ? (
        <div className="overflow-hidden rounded-lg bg-neutral-950 px-3">
          <JengaTower
            code={code}
            selectedLineNo={null}
            onSelectLine={() => undefined}
            interactive={false}
            collapsed={hasLoser}
            compact
          />
        </div>
      ) : null}

      <Button className="w-full" onClick={() => router.push(`/rooms/${roomCode}`)}>
        ロビーに戻る（再戦）
      </Button>
    </div>
  );
}
