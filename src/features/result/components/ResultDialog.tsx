"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Game, GameFinishReason } from "@/types/game";

// 敗者表示＋再戦ボタン。担当: ようた（#21 で FE-B から移管）

export interface ResultDialogProps {
  game: Game;
  /** loser_id に対応する表示名（TODO: profiles との JOIN 結果を呼び出し側で渡す） */
  loserNickname: string | null;
  roomCode: string;
  /**
   * 再戦の実行。渡されたときだけ「再戦する」ボタンを出す。
   * 渡さなければ従来どおり「トップに戻る」だけ（#26 / 配線は FE-B）。
   */
  onRematch?: () => void;
  /** 再戦リクエストの送信中。ボタンを押せなくする */
  isRematching?: boolean;
}

/** games.finish_reason（database.ts の game_finish_reason）の日本語表示。 */
const FINISH_REASON_LABEL: Record<GameFinishReason, string> = {
  test_failed: "テスト失敗",
  timeout: "時間切れ",
  no_lines_left: "抜ける行なし",
  aborted: "中断",
};

/** 見出しの下に出す一文。バッジだけだと何が起きたか伝わらないため。 */
const FINISH_REASON_TEXT: Record<GameFinishReason, string> = {
  test_failed: "抜いた行でコードが壊れ、タワーが崩れました。",
  timeout: "制限時間内に行を抜けませんでした。",
  no_lines_left: "抜ける行が尽きて、タワーが最後まで残りました。",
  aborted: "試合が途中で中断されました。",
};

/** 崩れたタワーの積み木。傾き・ずれ・色を1ブロックずつ指定する。 */
const RUBBLE = [
  { rotate: "-rotate-12", offset: "-translate-x-6", width: "w-24", tone: "bg-amber-700" },
  { rotate: "rotate-6", offset: "translate-x-8", width: "w-20", tone: "bg-amber-600" },
  { rotate: "-rotate-3", offset: "translate-x-1", width: "w-28", tone: "bg-amber-800" },
  { rotate: "rotate-12", offset: "-translate-x-9", width: "w-16", tone: "bg-amber-600" },
] as const;

export function ResultDialog({
  game,
  loserNickname,
  roomCode,
  onRematch,
  isRematching = false,
}: ResultDialogProps) {
  const router = useRouter();
  const finishReason = game.finish_reason;

  return (
    <section className="flex flex-col items-center gap-5 rounded-xl border-2 border-amber-900/25 bg-amber-50 p-6 text-center shadow-sm">
      <div className="flex flex-col items-center gap-0.5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-900/60">
          game over
        </p>
        {/* 作り直すときに伝えるので、コードは結果画面にも残しておく */}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-900/40">
          room {roomCode}
        </p>
      </div>

      {/* 崩れた積み木。装飾なので読み上げ対象から外す */}
      <div aria-hidden className="flex w-full flex-col items-center gap-1 py-1">
        {RUBBLE.map((block) => (
          <span
            key={block.rotate + block.offset}
            className={`h-3 rounded-sm shadow-sm ${block.width} ${block.tone} ${block.rotate} ${block.offset}`}
          />
        ))}
        <span className="mt-1 h-1 w-32 rounded-full bg-amber-900/20" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-amber-950">
          {loserNickname ? `${loserNickname} の負け！` : "対戦終了"}
        </h2>
        {loserNickname ? (
          <p className="text-sm text-amber-900/70">タワーを崩したのはこの人です</p>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-amber-800">
          {finishReason ? FINISH_REASON_LABEL[finishReason] : "理由不明"}
        </span>
        <p className="text-sm text-amber-900/80">
          {finishReason
            ? FINISH_REASON_TEXT[finishReason]
            : "終了理由が記録されていません。"}
        </p>
        <p className="text-xs tabular-nums text-amber-900/60">
          {game.turn_no} 手目で終了 / 残り {game.current_line_count ?? "-"} 行
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        {onRematch ? (
          <>
            <Button className="w-full" onClick={onRematch} disabled={isRematching}>
              {isRematching ? "準備中..." : "もう一度あそぶ"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
              トップに戻る
            </Button>
          </>
        ) : (
          <>
            {/*
             * onRematch が無いあいだは再戦できない。games が finished のままなので
             * /rooms/{roomCode} に戻してもこの結果画面に戻ってくるだけになる。
             * 新しいルームを作る導線が生きるよう、トップに戻す。
             */}
            <Button onClick={() => router.push("/")}>トップに戻る</Button>
            <p className="text-xs text-amber-900/50">再戦は準備中です</p>
          </>
        )}
      </div>
    </section>
  );
}
