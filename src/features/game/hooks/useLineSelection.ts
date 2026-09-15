"use client";

import { useState } from "react";
import { DIFFICULTY_LABEL, DIFFICULTY_RULE_TEXT, isDeletableUnder } from "@/lib/shared/difficulty";
import type { TurnDifficulty } from "@/types/game";

export function useLineSelection(currentCode: string, difficulty: TurnDifficulty | null) {
  const [selection, setSelection] = useState<{ code: string; lineNo: number } | null>(null);
  const selectedLineNo = selection !== null && selection.code === currentCode ? selection.lineNo : null;
  const selectedLineText =
    selectedLineNo === null ? null : currentCode.split("\n")[selectedLineNo - 1] ?? null;
  const blockedReason =
    difficulty && selectedLineText !== null && !isDeletableUnder(difficulty, selectedLineText)
      ? `${DIFFICULTY_LABEL[difficulty]} ではこの行は削除できません。${DIFFICULTY_RULE_TEXT[difficulty]}`
      : null;

  function selectLine(lineNo: number) {
    setSelection({ code: currentCode, lineNo });
  }

  return {
    selectedLineNo,
    blockedReason,
    selectLine,
    clearSelection: () => setSelection(null),
  };
}