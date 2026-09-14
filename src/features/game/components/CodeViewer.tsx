"use client";

// Monaco Editor ラッパ。担当: FE-B
// SSR では動かないため next/dynamic で遅延ロードする。

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export interface CodeViewerProps {
  code: string;
  language: string;
  /** 選択中の行番号（1始まり）。未選択なら null。 */
  selectedLineNo: number | null;
  onSelectLine: (lineNo: number) => void;
}

// TODO(FE-B): selectedLineNo をエディタ上でハイライト表示する（decorations）。
export function CodeViewer({ code, language, selectedLineNo, onSelectLine }: CodeViewerProps) {
  const handleMount: OnMount = (editor) => {
    editor.onMouseDown((event) => {
      const lineNo = event.target.position?.lineNumber;
      if (lineNo) {
        onSelectLine(lineNo);
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-md border border-gray-300">
      <div className="h-96">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onMount={handleMount}
          options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: "on" }}
        />
      </div>
      <p className="border-t border-gray-200 px-2 py-1 text-xs text-gray-500">
        {selectedLineNo !== null ? `選択中の行: ${selectedLineNo}` : "削除する行をクリックしてください"}
      </p>
    </div>
  );
}
