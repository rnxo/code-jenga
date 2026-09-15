"use client";

// Monaco Editor ラッパ。担当: FE-B
// SSR では動かないため next/dynamic で遅延ロードする。

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// monaco-editor を直接 import せず、OnMount の引数型からエディタ型を取り出す。
type CodeEditor = Parameters<OnMount>[0];
type DecorationsCollection = ReturnType<CodeEditor["createDecorationsCollection"]>;

export interface CodeViewerProps {
  code: string;
  language: string;
  /** 選択中の行番号（1始まり）。未選択なら null。 */
  selectedLineNo: number | null;
  onSelectLine: (lineNo: number) => void;
}

export function CodeViewer({ code, language, selectedLineNo, onSelectLine }: CodeViewerProps) {
  const decorationsRef = useRef<DecorationsCollection | null>(null);

  const handleMount: OnMount = (editor) => {
    decorationsRef.current = editor.createDecorationsCollection();
    editor.onMouseDown((event) => {
      const lineNo = event.target.position?.lineNumber;
      if (lineNo) {
        onSelectLine(lineNo);
      }
    });
  };

  // 選択行を行全体の背景色でハイライトする。未選択なら装飾を消す。
  useEffect(() => {
    const decorations = decorationsRef.current;
    if (!decorations) return;
    if (selectedLineNo === null) {
      decorations.clear();
      return;
    }
    decorations.set([
      {
        range: {
          startLineNumber: selectedLineNo,
          startColumn: 1,
          endLineNumber: selectedLineNo,
          endColumn: 1,
        },
        options: { isWholeLine: true, className: "bg-yellow-200" },
      },
    ]);
  }, [selectedLineNo]);

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
