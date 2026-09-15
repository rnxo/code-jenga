"use client";

import { useState } from "react";
import type { MascotMood } from "../mascot-lines";

// カイル風マスコットの見た目。担当: 見た目（Nezumi / ようた）
// 渡されたセリフを吹き出しで出すだけ。何を喋るかは GameBoard 側（mascot-lines.ts）で決める。
// キャラの絵はいまは絵文字。GIF / スプライトに差し替えるときは FACE の部分だけ変えればよい。

export interface MascotProps {
  message: string | null;
  mood: MascotMood;
}

const FACE: Record<MascotMood, string> = {
  idle: "🐭",
  smug: "😏",
  panic: "😱",
};

const BUBBLE_CLASS: Record<MascotMood, string> = {
  idle: "border-amber-300 bg-white text-amber-950",
  smug: "border-amber-400 bg-amber-50 text-amber-950",
  panic: "border-red-400 bg-red-50 text-red-800",
};

export function Mascot({ message, mood }: MascotProps) {
  const [isMuted, setIsMuted] = useState(false);

  if (isMuted) {
    return (
      <button
        type="button"
        onClick={() => setIsMuted(false)}
        className="fixed right-4 bottom-4 z-40 rounded-full border border-amber-300 bg-white/90 px-3 py-1 text-xs text-amber-900/70 shadow hover:bg-amber-50"
        aria-label="マスコットを戻す"
      >
        🐭 戻す
      </button>
    );
  }

  return (
    // スマホ幅では吹き出しが画面いっぱいに広がり、盤面の下（判定・退出ボタン）に
    // 重なる。狭いときだけ幅を絞る
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[70vw] items-end gap-2 sm:max-w-xs">
      {message ? (
        <div
          className={`pointer-events-auto relative rounded-xl border-2 px-3 py-2 text-sm shadow-md ${BUBBLE_CLASS[mood]}`}
          role="status"
        >
          {message}
          {/* 吹き出しのしっぽ */}
          <span
            aria-hidden
            className={`absolute -right-2 bottom-3 h-3 w-3 rotate-45 border-r-2 border-b-2 ${BUBBLE_CLASS[mood]}`}
          />
        </div>
      ) : null}
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <span
          aria-hidden
          className={`select-none text-5xl drop-shadow ${mood === "panic" ? "animate-bounce" : "animate-pulse"}`}
        >
          {FACE[mood]}
        </span>
        <button
          type="button"
          onClick={() => setIsMuted(true)}
          className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-amber-900/60 hover:bg-white"
        >
          黙らせる
        </button>
      </div>
    </div>
  );
}
