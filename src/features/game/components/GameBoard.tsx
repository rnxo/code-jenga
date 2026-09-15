"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { LeaveButton } from "@/components/ui/LeaveButton";
import { DEFAULT_LANGUAGE } from "@/lib/shared/language";
import { useGameRealtime } from "../hooks/useGameRealtime";
import { useGameTimeout } from "../hooks/useGameTimeout";
import { useLineSelection } from "../hooks/useLineSelection";
import { GameBoardMascot } from "./GameBoardMascot";
import { GameBoardPlayfield } from "./GameBoardPlayfield";
import { TurnIndicator } from "./TurnIndicator";

// 盤面全体のコンテナ。担当: FE-B

export interface GameBoardProps {
  gameId: string;
  /** 自分の profile id（手番判定に使う） */
  currentUserId: string;
}

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

  useGameTimeout(gameId, gameStatus, turnDeadlineAt);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const isMyTurn = game?.current_player_id === currentUserId;
  const latestTurn = turns.at(-1) ?? null;
  const currentCode = game?.current_code ?? "";
  const difficulty = game?.current_turn_difficulty ?? null;
  // ロビーでホストが選んだ言語。行の削除可否判定とシンタックスハイライトの両方に使う。
  const language = game?.language ?? DEFAULT_LANGUAGE;
  const { selectedLineNo, blockedReason, selectLine, clearSelection } = useLineSelection(
    currentCode,
    difficulty,
    language,
  );

  if (isLoading) {
    return <Spinner label="盤面を読み込み中..." />;
  }

  if (errorMessage || !game) {
    return <p className="text-sm text-red-600">{errorMessage ?? "試合が見つかりません。"}</p>;
  }

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
      clearSelection();
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
      {/*
       * 3D タワーは「見せ場」担当。行の選択は下の CodeViewer と同じ state を共有するので、
       * どちらをクリックしても同じ行が選ばれる（Monaco 側のハイライトも連動する）。
       */}
      <GameBoardPlayfield
        code={currentCode}
        language={language}
        selectedLineNo={selectedLineNo}
        isMyTurn={isMyTurn}
        isSubmitting={isSubmitting}
        submitError={submitError}
        blockedReason={blockedReason}
        latestTurn={latestTurn}
        onSelectLine={selectLine}
        onConfirmDelete={handleDeleteLine}
        verdict={latestTurn === null ? null : latestTurn.player_id === currentUserId ? "lose" : "win"}
      />
      {/* 誤爆しにくいよう一番下に小さく置く */}
      {leaveError ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-center text-sm text-red-700">
          {leaveError}
        </p>
      ) : null}
      <LeaveButton onLeave={handleLeave} isLeaving={isLeaving} size="quiet" />
      <GameBoardMascot
        isMyTurn={isMyTurn}
        selectedLineNo={selectedLineNo}
        blockedReason={blockedReason}
        turnDeadlineAt={turnDeadlineAt}
        latestTurnResult={latestTurn?.result ?? null}
        latestTurnByMe={latestTurn?.player_id === currentUserId}
        turnNo={game.turn_no}
      />
    </div>
  );
}
