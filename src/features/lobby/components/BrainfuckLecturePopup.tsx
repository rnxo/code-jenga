"use client";

import { useEffect } from "react";

// Brainfuck の講義コードを見せるポップアップ。担当: FE-A
//
// ロビーで言語が Brainfuck のとき、ホスト・参加者の区別なく全員が開ける。
// 8命令の一覧と、コメント付きの短いサンプル（"Hi" を出力する）で「行を抜くと何が壊れるか」の勘所を掴んでもらう。
// 閉じるボタン／背景クリック／Esc で消える（DogezaPopup と同じ作法）。

/** Brainfuck の8命令とその意味。 */
const BRAINFUCK_COMMANDS: ReadonlyArray<{ command: string; description: string }> = [
  { command: ">", description: "ポインタを右のセルへ動かす" },
  { command: "<", description: "ポインタを左のセルへ動かす" },
  { command: "+", description: "今のセルの値を 1 増やす（255 の次は 0）" },
  { command: "-", description: "今のセルの値を 1 減らす（0 の次は 255）" },
  { command: ".", description: "今のセルの値を文字コードとして出力する" },
  { command: ",", description: "1 文字読み込む（この対戦では入力は無く 0 になる）" },
  { command: "[", description: "今のセルが 0 なら、対応する ] の直後へ飛ぶ" },
  { command: "]", description: "今のセルが 0 でなければ、対応する [ の直後へ戻る" },
];

/**
 * 講義用サンプル。"Hi" を出力する。
 * コメント欄には 8 命令の文字（+ - < > . , [ ]）を書かないこと。書くと命令として実行される。
 */
const LECTURE_CODE = `++++++++            セル0 を 8 にする
[>+++++++++<-]      セル1 に 9 を 8 回足す（72 になる）
>.                  72 は文字コードで H なので出力
<++++               セル0 を 4 にする
[>++++++++<-]       セル1 に 8 を 4 回足す（104 になる）
>+.                 1 足して 105 は i なので出力`;

export interface BrainfuckLecturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrainfuckLecturePopup({ isOpen, onClose }: BrainfuckLecturePopupProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Brainfuck 講義コード"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-xl border-4 border-amber-300 bg-white p-5 shadow-2xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg font-bold text-white transition-colors hover:bg-black/80"
        >
          ×
        </button>

        <header>
          <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
            brainfuck lecture
          </p>
          <h2 className="text-xl font-bold">Brainfuck 講義コード</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            命令は 8 種類だけ。命令以外の文字はすべてコメントとして無視されます。
          </p>
        </header>

        <section>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            commands
          </p>
          <table className="w-full text-sm">
            <tbody>
              {BRAINFUCK_COMMANDS.map(({ command, description }) => (
                <tr key={command} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="w-12 py-1.5 pr-3 text-center font-mono text-base font-bold text-amber-600">
                    {command}
                  </td>
                  <td className="py-1.5 text-gray-800 dark:text-gray-200">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            sample: &quot;Hi&quot; を出力する
          </p>
          <pre className="overflow-x-auto rounded-sm bg-gray-100 p-3 font-mono text-xs leading-relaxed text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            {LECTURE_CODE}
          </pre>
          <p className="mt-2 text-xs text-gray-500">
            対戦では 1 行ずつ抜いていきます。ループの途中や出力の行を抜くと、結果が変わってタワーが崩れます。
          </p>
        </section>
      </div>
    </div>
  );
}
