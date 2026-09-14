"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
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
  // 直前の手でアウト／タイムアウトになっていたらタワーを崩す
  const hasCollapsed = latestTurn !== null && latestTurn.result !== "safe";

  async function handleDeleteLine() {
    if (selectedLineNo === null) {
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
        collapsed={hasCollapsed}
      />
      {isMyTurn && !hasCollapsed ? (
        <LineDeleteControls
          selectedLineNo={selectedLineNo}
          isSubmitting={isSubmitting}
          errorMessage={submitError}
          onConfirm={handleDeleteLine}
        />
      ) : null}
      <TestResultPanel turn={latestTurn} />
    </div>
  );
}
