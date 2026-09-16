"use client";

// Monaco Editor ラッパ。担当: FE-B
// SSR では動かないため next/dynamic で遅延ロードする。

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import { CODE_TOP_PADDING_PX, LINE_HEIGHT_PX } from "../board-metrics";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CodeEditor = Parameters<OnMount>[0];
type DecorationsCollection = ReturnType<CodeEditor["createDecorationsCollection"]>;

function applySelection(
  decorations: DecorationsCollection,
  lineNo: number | null,
): void {
  if (lineNo === null) {
    decorations.clear();
    return;
  }

  decorations.set([
    {
      range: {
        startLineNumber: lineNo,
        startColumn: 1,
        endLineNumber: lineNo,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: "bg-yellow-200",
      },
    },
  ]);
}

export interface CodeViewerProps {
  code: string;
  language: string;
  selectedLineNo: number | null;
  onSelectLine: (lineNo: number) => void;
}

/*
 * Monaco はコードの全部の行ぶんの高さで描く。中でスクロールさせない。
 *
 * 中でスクロールすると、横に並んだ 3D タワーとの行のずれが直せない
 * （あちらはスクロールしないため）。長いコードは、外側の BoardStack が
 * タワーごとまとめてスクロールする。
 */
const RIGHT_PADDING_PX = 24;

interface EditorSize {
  width: number;
  height: number;
}

export function CodeViewer({
  code,
  language,
  selectedLineNo,
  onSelectLine,
}: CodeViewerProps) {
  const decorationsRef = useRef<DecorationsCollection | null>(null);
  const [size, setSize] = useState<EditorSize | null>(null);

  const handleMount: OnMount = (editor) => {
    const fitToContent = () => {
      const { contentLeft } = editor.getLayoutInfo();

      const next: EditorSize = {
        // コードの実際の横幅に合わせる。
        // 画面より広い場合は、外側の CodeViewer で横スクロールする。
        width: Math.ceil(
          contentLeft + editor.getContentWidth() + RIGHT_PADDING_PX,
        ),

        // 全部の行が入る高さ。スクロールは外側に任せる。
        height: Math.ceil(editor.getContentHeight()),
      };

      // サイズが変わっていない場合は不要な再レンダーを避ける。
      setSize((prev) =>
        prev &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };

    fitToContent();

    // コードの内容やレイアウトによって必要サイズが変わったら再計算する。
    editor.onDidContentSizeChange(fitToContent);

    // 選択中の行をハイライトするための Decoration を作成する。
    decorationsRef.current = editor.createDecorationsCollection();
    applySelection(decorationsRef.current, selectedLineNo);

    // Monaco 上で行をクリックしたら、その行を選択する。
    editor.onMouseDown((event) => {
      const lineNo = event.target.position?.lineNumber;

      if (lineNo) {
        onSelectLine(lineNo);
      }
    });
  };

  // React 側の選択行が変わったら Monaco のハイライトも更新する。
  useEffect(() => {
    if (decorationsRef.current) {
      applySelection(decorationsRef.current, selectedLineNo);
    }
  }, [selectedLineNo]);

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-md border border-gray-300 bg-white">
      {/*
        Monaco はコードの実際の内容幅に合わせて横に広がる。
        画面幅を超えた場合は、この親要素の中で横スクロールする。
        max-w-full にすると Monaco 側の幅を無理に縮めたり、
        overflow-hidden にすると長いコードを切ってしまうため、
        ここでは max-w-none にする。
      */}
      <div
        className="max-w-none"
        style={
          size
            ? {
                width: size.width,
                height: size.height,
              }
            : {
                height: 240,
              }
        }
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
            // 行送りと上の余白は、3D タワーと揃えるため board-metrics.ts から取る。
            // ここだけ直すと、横に並べたときに N 行目どうしがずれる
            lineHeight: LINE_HEIGHT_PX,
            padding: { top: CODE_TOP_PADDING_PX, bottom: CODE_TOP_PADDING_PX },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            overviewRulerLanes: 0,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
          }}
        />
      </div>

      <p className="border-t border-gray-200 px-2 py-1 text-xs text-gray-500">
        {selectedLineNo !== null
          ? `選択中の行: ${selectedLineNo}`
          : "削除する行をクリックしてください"}
      </p>
    </div>
  );
}