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
      {/*
       * 操作と判定はコードより先に置く。下に置くと、コードが長いほど画面の
       * 外へ押し出されて、削除ボタンを押すのにスクロールが要る。
       */}
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

      {/* 狭い画面では片方だけ出す（切り替えは BoardStack の中） */}
      <BoardStack
        tower={
          <JengaTower
            code={code}
            selectedLineNo={selectedLineNo}
            onSelectLine={onSelectLine}
            interactive={isMyTurn && !isSubmitting}
            collapsed={latestTurn !== null && latestTurn.result !== "safe"}
            verdict={verdict}
            lineAligned
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
    </>
  );
}