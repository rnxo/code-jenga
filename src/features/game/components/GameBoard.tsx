"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder } from "@/lib/shared/difficulty";
import { useGameRealtime } from "../hooks/useGameRealtime";
import { JengaTower } from "./JengaTower";
import { LineDeleteControls } from "./LineDeleteControls";
import { TestResultPanel } from "./TestResultPanel";
import { TurnIndicator } from "./TurnIndicator";

// 盤面全体のコンテナ。担当: FE-B

export interface GameBoardProps {
  gameId: string;
  /** 自分の profile id（手番判定に使う） */
  currentUserId: string;
}

export function GameBoard({ gameId, currentUserId }: GameBoardProps) {
  const { game, turns, isLoading, errorMessage } = useGameRealtime(gameId);
  const [selectedLineNo, setSelectedLineNo] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return <Spinner label="盤面を読み込み中..." />;
  }

  if (errorMessage || !game) {
    return <p className="text-sm text-red-600">{errorMessage ?? "試合が見つかりません。"}</p>;
  }

  const isMyTurn = game.current_player_id === currentUserId;
  const latestTurn = turns.at(-1) ?? null;

  const selectedLineText =
    selectedLineNo === null ? null : (game.current_code ?? "").split("\n")[selectedLineNo - 1] ?? null;
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
      setSelectedLineNo(null);
    }
    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <TurnIndicator game={game} isMyTurn={isMyTurn} />
      <JengaTower
        code={game.current_code ?? ""}
        selectedLineNo={selectedLineNo}
        onSelectLine={setSelectedLineNo}
        interactive={isMyTurn && !isSubmitting}
        collapsed={latestTurn !== null && latestTurn.result !== "safe"}
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
    </div>
  );
}
