"use client";

import { useState } from "react";
import type { MascotMood } from "../mascot-lines";

// カイル風マスコットの見た目。担当: 見た目（Nezumi / ようた）
// 渡されたセリフを吹き出しで出すだけ。何を喋るかは GameBoard 側（mascot-lines.ts）で決める。
// キャラの絵は public/images/mascot/{mood}.gif|png（#42）。画像がまだ無い（404）間は絵文字で代用する。
// GIF は自前で動くので CSS のアニメを付けない（animated）。PNG の表情は CSS で揺らす。

export interface MascotProps {
  message: string | null;
  mood: MascotMood;
  /**
   * 吹き出しの位置。盤面はキャラの左（横並び）、タイトルはキャラの上（縦並び）。
   * 上に出すと右端の細い列に収まり、中央のボタンを隠さない。
   */
  bubblePlacement?: "left" | "top";
  /** 吹き出しをクリックしたときの処理。渡すとクリックできる見た目になる（タイトルでセリフ送り） */
  onBubbleClick?: () => void;
}

const FACE: Record<MascotMood, { src: string; emoji: string; animated: boolean }> = {
  idle: { src: "/images/mascot/idle.gif", emoji: "🐭", animated: true },
  smug: { src: "/images/mascot/smug.png", emoji: "😏", animated: false },
  panic: { src: "/images/mascot/panic.png", emoji: "😱", animated: false },
};

const BUBBLE_CLASS: Record<MascotMood, string> = {
  idle: "border-amber-300 bg-white text-amber-950",
  smug: "border-amber-400 bg-amber-50 text-amber-950",
  panic: "border-red-400 bg-red-50 text-red-800",
};

export function Mascot({ message, mood, bubblePlacement = "left", onBubbleClick }: MascotProps) {
  const [isMuted, setIsMuted] = useState(false);
  /** 読み込みに失敗した表情。その表情だけ絵文字に戻す */
  const [failedMoods, setFailedMoods] = useState<Partial<Record<MascotMood, true>>>({});
  const face = FACE[mood];
  const motionClass = mood === "panic" ? "animate-bounce" : "animate-pulse";

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

  const isTop = bubblePlacement === "top";
  const bubbleClass = `pointer-events-auto relative rounded-xl border-2 px-3 py-2 text-sm shadow-md ${BUBBLE_CLASS[mood]}`;
  const bubbleContent = (
    <>
      {message}
      {/* 吹き出しのしっぽ。横並びなら右（キャラ側）、縦並びなら下（キャラ側） */}
      <span
        aria-hidden
        className={`absolute h-3 w-3 rotate-45 border-r-2 border-b-2 ${BUBBLE_CLASS[mood]} ${
          isTop ? "right-6 -bottom-2" : "-right-2 bottom-3"
        }`}
      />
    </>
  );

  return (
    // スマホ幅では吹き出しが画面いっぱいに広がり、盤面の下（判定・退出ボタン）に
    // 重なる。狭いときだけ幅を絞る
    <div
      className={`pointer-events-none fixed right-4 bottom-4 z-40 flex gap-2 ${
        isTop ? "max-w-[60vw] flex-col items-end sm:max-w-[16rem]" : "max-w-[70vw] items-end sm:max-w-xs"
      }`}
    >
      {message && onBubbleClick ? (
        <button
          type="button"
          onClick={onBubbleClick}
          className={`${bubbleClass} cursor-pointer text-left hover:brightness-95`}
          aria-label="次のセリフ"
        >
          {bubbleContent}
        </button>
      ) : message ? (
        <div className={bubbleClass} role="status">
          {bubbleContent}
        </div>
      ) : null}
      <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-1">
        {failedMoods[mood] ? (
          <span aria-hidden className={`select-none text-5xl drop-shadow ${motionClass}`}>
            {face.emoji}
          </span>
        ) : (
          // 小さな固定画像で、後で GIF にする予定なので next/image の最適化は使わない
          // eslint-disable-next-line @next/next/no-img-element
          <img
            aria-hidden
            src={face.src}
            alt=""
            width={64}
            height={64}
            className={`h-16 w-16 select-none object-contain drop-shadow ${face.animated ? "" : motionClass}`}
            onError={() => setFailedMoods((prev) => ({ ...prev, [mood]: true }))}
          />
        )}
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
