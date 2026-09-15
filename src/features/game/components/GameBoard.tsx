"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { LeaveButton } from "@/components/ui/LeaveButton";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder } from "@/lib/shared/difficulty";
import { useGameRealtime } from "../hooks/useGameRealtime";
import { CodeViewer } from "./CodeViewer";
import { LineDeleteControls } from "./LineDeleteControls";
import { TestResultPanel } from "./TestResultPanel";
import { TurnIndicator } from "./TurnIndicator";

// 盤面全体のコンテナ。担当: FE-B

export interface GameBoardProps {
  gameId: string;
  /** 自分の profile id（手番判定に使う） */
  currentUserId: string;
}

/** 締切を過ぎてからタイムアウト確定を叩くまでの猶予。端末の時計ズレで「まだ過ぎていない」と弾かれるのを避ける。 */
const TIMEOUT_GRACE_MS = 1500;
/** それでも弾かれたとき（時計が大きく遅れている端末）に1回だけ叩き直すまでの間隔。 */
const TIMEOUT_RETRY_MS = 3000;

export function GameBoard({ gameId, currentUserId }: GameBoardProps) {
  const router = useRouter();
  const { game, turns, isLoading, errorMessage } = useGameRealtime(gameId);
  const gameStatus = game?.status ?? null;
  const turnDeadlineAt = game?.turn_deadline_at ?? null;

  // 決着（finished / aborted）したら page.tsx に読み直させて結果画面へ切り替える。
  useEffect(() => {
    if (gameStatus !== null && gameStatus !== "playing") {
      router.refresh();
    }
  }, [gameStatus, router]);

  // 締切を過ぎたらタイムアウト確定を叩く。参加者なら誰が叩いてもよく、
  // 先に手が確定していればサーバーが applied=false を返すだけなので二重に呼んでも害はない。
  useEffect(() => {
    if (gameStatus !== "playing" || !turnDeadlineAt) {
      return;
    }
    const delayMs = new Date(turnDeadlineAt).getTime() - Date.now() + TIMEOUT_GRACE_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const timer = setTimeout(() => {
      void apiClient.timeoutTurn(gameId).then((result) => {
        if (!result.ok) {
          console.error(`タイムアウトの確定に失敗しました: ${result.error.message}`);
          retryTimer = setTimeout(() => void apiClient.timeoutTurn(gameId), TIMEOUT_RETRY_MS);
        }
      });
    }, Math.max(0, delayMs));
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [gameId, gameStatus, turnDeadlineAt]);
  // 選択は「どのコードに対する選択か」と一緒に持ち、相手の手で current_code が変わったら自動的に無効になる。
  const [selection, setSelection] = useState<{ code: string; lineNo: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  if (isLoading) {
    return <Spinner label="盤面を読み込み中..." />;
  }

  if (errorMessage || !game) {
    return <p className="text-sm text-red-600">{errorMessage ?? "試合が見つかりません。"}</p>;
  }

  const isMyTurn = game.current_player_id === currentUserId;
  const latestTurn = turns.at(-1) ?? null;
  const currentCode = game.current_code ?? "";
  const selectedLineNo = selection !== null && selection.code === currentCode ? selection.lineNo : null;

  const selectedLineText =
    selectedLineNo === null ? null : currentCode.split("\n")[selectedLineNo - 1] ?? null;
  const difficulty = game.current_turn_difficulty;
  const blockedReason =
    difficulty && selectedLineText !== null && !isDeletableUnder(difficulty, selectedLineText)
      ? `${DIFFICULTY_LABEL[difficulty]} ではこの行は削除できません。${DIFFICULTY_RULE_TEXT[difficulty]}`
      : null;

  async function handleDeleteLine() {
    if (selectedLineNo === null || blockedReason !== null) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const result = await apiClient.createTurn(gameId, { lineNo: selectedLineNo });

    if (!result.ok) {
      setSubmitError(result.error.message);
    } else {
      setSelection(null);
    }
    setIsSubmitting(false);
  }

  // 手番中に抜けると次のプレイヤーへ回り、残り1人なら中断になる（サーバー側で処理）。
  async function handleLeave() {
    setIsLeaving(true);
    setLeaveError(null);
    const result = await apiClient.leaveGame(gameId);
    if (!result.ok) {
      setLeaveError(result.error.message);
      setIsLeaving(false);
      return;
    }
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <TurnIndicator game={game} isMyTurn={isMyTurn} />
      <CodeViewer
        code={currentCode}
        language="typescript"
        selectedLineNo={selectedLineNo}
        onSelectLine={(lineNo) => setSelection({ code: currentCode, lineNo })}
      />
      {isMyTurn ? (
        <LineDeleteControls
          selectedLineNo={selectedLineNo}
          isSubmitting={isSubmitting}
          errorMessage={submitError}
          blockedReason={blockedReason}
          onConfirm={handleDeleteLine}
        />
      ) : null}
      <TestResultPanel turn={latestTurn} />
      {/* 誤爆しにくいよう一番下に小さく置く */}
      {leaveError ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-center text-sm text-red-700">
          {leaveError}
        </p>
      ) : null}
      <LeaveButton onLeave={handleLeave} isLeaving={isLeaving} size="quiet" />
    </div>
  );
}
