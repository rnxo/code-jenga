"use client";

import { useEffect, useState } from "react";
import type { MascotMood } from "../mascot-lines";
import { speakMascotLine, stopMascotVoice } from "../mascot-voice";

// カイル風マスコットの見た目。担当: 見た目（Nezumi / ようた）
// 渡されたセリフを吹き出しで出すだけ。何を喋るかは GameBoard 側（mascot-lines.ts）で決める。
// キャラの絵は public/images/mascot/{mood}.gif|png（#42）。画像がまだ無い（404）間は絵文字で代用する。
// GIF は自前で動くので CSS のアニメを付けない（animated）。PNG の表情は CSS で揺らす。
// 動きを控えたい設定（prefers-reduced-motion: reduce）のときは、同じ絵の静止版（PNG）を出す。
// セリフが変わるたびに声を出す（mascot-voice.ts）。「黙らせる」と右上の 🔊 のどちらでも黙る。

export interface MascotProps {
  message: string | null;
  mood: MascotMood;
  /** 吹き出しの位置。キャラの左（横並び）か上（縦並び） */
  bubblePlacement?: "left" | "top";
  /** 吹き出しをクリックしたときの処理。渡すとクリックできる見た目になる（タイトルでセリフ送り） */
  onBubbleClick?: () => void;
  /**
   * 画面右下に固定するか。false なら親が置き場所を決める
   * （タイトルでは「始める」に被せて、わざと邪魔をする）。
   */
  anchored?: boolean;
}

const FACE: Record<
  MascotMood,
  { src: string; still: string; emoji: string; animated: boolean }
> = {
  idle: { src: "/images/mascot/idle.gif", still: "/images/mascot/idle.png", emoji: "🐭", animated: true },
  smug: { src: "/images/mascot/smug.gif", still: "/images/mascot/smug.png", emoji: "😏", animated: true },
  panic: { src: "/images/mascot/panic.gif", still: "/images/mascot/panic.png", emoji: "😱", animated: true },
};

const BUBBLE_CLASS: Record<MascotMood, string> = {
  idle: "border-amber-300 bg-white text-amber-950",
  smug: "border-amber-400 bg-amber-50 text-amber-950",
  panic: "border-red-400 bg-red-50 text-red-800",
};

export function Mascot({
  message,
  mood,
  bubblePlacement = "left",
  onBubbleClick,
  anchored = true,
}: MascotProps) {
  const [isMuted, setIsMuted] = useState(false);
  /** 読み込みに失敗した表情。その表情だけ絵文字に戻す */
  const [failedMoods, setFailedMoods] = useState<Partial<Record<MascotMood, true>>>({});
  // セリフが変わったら喋る。黙らせているあいだは声も出さない。
  // 効果音そのもののオンオフ（右上の 🔊）は mascot-voice.ts 側で見ている。
  useEffect(() => {
    if (message === null || isMuted) {
      stopMascotVoice();
      return;
    }
    speakMascotLine(message, mood);
  }, [message, mood, isMuted]);

  // 画面から消えるときは言いかけを止める（結果画面へ切り替わった直後など）
  useEffect(() => stopMascotVoice, []);

  const face = FACE[mood];
  const motionClass = mood === "panic" ? "animate-bounce" : "animate-pulse";
  const anchorClass = anchored ? "fixed right-4 bottom-4 z-40" : "relative z-40";

  if (isMuted) {
    return (
      <button
        type="button"
        onClick={() => setIsMuted(false)}
        className={`${anchorClass} rounded-full border border-amber-300 bg-white/90 px-3 py-1 text-xs text-amber-900/70 shadow hover:bg-amber-50`}
        aria-label="マスコットを戻す"
      >
        戻す
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
      className={`pointer-events-none ${anchorClass} flex gap-2 ${
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
          <span
            aria-hidden
            className={`select-none text-5xl drop-shadow motion-reduce:animate-none ${motionClass}`}
          >
            {face.emoji}
          </span>
        ) : (
          // 動きを控えたい設定のときは静止版（PNG）を先に当てる。
          // <picture> の source は img より先に評価されるので、GIF は読み込まれない。
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={face.still} />
            {/* 小さな固定画像なので next/image の最適化は使わない */}
            <img
              aria-hidden
              src={face.src}
              alt=""
              width={64}
              height={64}
              className={`h-16 w-16 select-none object-contain drop-shadow motion-reduce:animate-none ${
                face.animated ? "" : motionClass
              }`}
              onError={() => setFailedMoods((prev) => ({ ...prev, [mood]: true }))}
            />
          </picture>
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
