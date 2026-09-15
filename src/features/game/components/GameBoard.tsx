"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
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

export function GameBoard({ gameId, currentUserId }: GameBoardProps) {
  const { game, turns, isLoading, errorMessage } = useGameRealtime(gameId);
  // 選択は「どのコードに対する選択か」と一緒に持ち、相手の手で current_code が変わったら自動的に無効になる。
  const [selection, setSelection] = useState<{ code: string; lineNo: number } | null>(null);
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
    </div>
  );
}
