"use client";

import { MONACO_LANGUAGE_ID } from "@/lib/shared/language";
import type { CodeLanguage, Turn } from "@/types/game";
import { BoardStack } from "./BoardStack";
import type { CollapseVerdict } from "./CollapseMonuments";
import { CodeViewer } from "./CodeViewer";
import { JengaTower } from "./JengaTower";
import { LineDeleteControls } from "./LineDeleteControls";
import { TestResultPanel } from "./TestResultPanel";

interface GameBoardPlayfieldProps {
  code: string;
  /** シンタックスハイライトに使う実行言語（ロビーでホストが選んだもの） */
  language: CodeLanguage;
  selectedLineNo: number | null;
  isMyTurn: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  blockedReason: string | null;
  latestTurn: Turn | null;
  onSelectLine: (lineNo: number) => void;
  onConfirmDelete: () => void;
  /** 崩れたときに像へ出す勝敗。見ている人から見た結果（#39） */
  verdict?: CollapseVerdict | null;
}

export function GameBoardPlayfield({
  code,
  language,
  selectedLineNo,
  isMyTurn,
  isSubmitting,
  submitError,
  blockedReason,
  latestTurn,
  onSelectLine,
  onConfirmDelete,
  verdict = null,
}: GameBoardPlayfieldProps) {
  return (
    <>
      {/* 縦に入り切らない画面では、既定で 2D のコードを畳む（切り替えは BoardStack の中） */}
      <BoardStack
        tower={
          <JengaTower
            code={code}
            selectedLineNo={selectedLineNo}
            onSelectLine={onSelectLine}
            interactive={isMyTurn && !isSubmitting}
            collapsed={latestTurn !== null && latestTurn.result !== "safe"}
            verdict={verdict}
          />
        }
        code={
          <CodeViewer
            code={code}
            language={MONACO_LANGUAGE_ID[language]}
            selectedLineNo={selectedLineNo}
            onSelectLine={onSelectLine}
          />
        }
      />
      {isMyTurn ? (
        <LineDeleteControls
          selectedLineNo={selectedLineNo}
          isSubmitting={isSubmitting}
          errorMessage={submitError}
          blockedReason={blockedReason}
          onConfirm={onConfirmDelete}
        />
      ) : null}
      <TestResultPanel turn={latestTurn} />
    </>
  );
}