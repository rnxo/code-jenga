"use client";

// Monaco Editor ラッパ。担当: FE-B
// SSR では動かないため next/dynamic で遅延ロードする。

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// monaco-editor を直接 import せず、OnMount の引数型からエディタ型を取り出す。
type CodeEditor = Parameters<OnMount>[0];
type DecorationsCollection = ReturnType<CodeEditor["createDecorationsCollection"]>;

/** 選択行を行全体の背景色でハイライトする。未選択なら装飾を消す。 */
function applySelection(decorations: DecorationsCollection, lineNo: number | null): void {
  if (lineNo === null) {
    decorations.clear();
    return;
  }
  decorations.set([
    {
      range: { startLineNumber: lineNo, startColumn: 1, endLineNumber: lineNo, endColumn: 1 },
      // クラス名はリテラルのままにする（組み立てると Tailwind のスキャンに乗らない）。
      options: { isWholeLine: true, className: "bg-yellow-200" },
    },
  ]);
}

export interface CodeViewerProps {
  code: string;
  language: string;
  /** 選択中の行番号（1始まり）。未選択なら null。 */
  selectedLineNo: number | null;
  onSelectLine: (lineNo: number) => void;
}

/** 行数・行幅に合わせるときの上限。これを超えるコードはエディタ内でスクロールする。 */
const MAX_HEIGHT_PX = 640;
/** 一番長い行の右に少し余白を残す（行末ぴったりだと詰まって見える）。 */
const RIGHT_PADDING_PX = 24;

interface EditorSize {
  width: number;
  height: number;
}

export function CodeViewer({ code, language, selectedLineNo, onSelectLine }: CodeViewerProps) {
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  // コードの一番長い行と行数に合わせてエディタの大きさを決める（Monaco 側の実測値を使う）。
  const [size, setSize] = useState<EditorSize | null>(null);

  const handleMount: OnMount = (editor) => {
    const fitToContent = () => {
      const { contentLeft } = editor.getLayoutInfo();
      const next: EditorSize = {
        width: Math.ceil(contentLeft + editor.getContentWidth() + RIGHT_PADDING_PX),
        height: Math.min(MAX_HEIGHT_PX, Math.ceil(editor.getContentHeight())),
      };
      setSize((prev) =>
        prev && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    fitToContent();
    editor.onDidContentSizeChange(fitToContent);

    decorationsRef.current = editor.createDecorationsCollection();
    // Monaco は遅延ロードなので、選択済みの状態でマウントされることがある。その場合もここで反映する。
    applySelection(decorationsRef.current, selectedLineNo);
    editor.onMouseDown((event) => {
      const lineNo = event.target.position?.lineNumber;
      if (lineNo) {
        onSelectLine(lineNo);
      }
    });
  };

  useEffect(() => {
    if (decorationsRef.current) {
      applySelection(decorationsRef.current, selectedLineNo);
    }
  }, [selectedLineNo]);

  return (
    <div className="max-w-full overflow-hidden rounded-md border border-gray-300 bg-white">
      {/* 実測前は仮の高さ。画面幅より長い行があるときは max-width で止めてエディタ内で横スクロールさせる。 */}
      <div
        className="max-w-full"
        style={size ? { width: size.width, height: size.height } : { height: 240 }}
      >
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onMount={handleMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            overviewRulerLanes: 0,
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
        />
      </div>
      <p className="border-t border-gray-200 px-2 py-1 text-xs text-gray-500">
        {selectedLineNo !== null ? `選択中の行: ${selectedLineNo}` : "削除する行をクリックしてください"}
      </p>
    </div>
  );
}
