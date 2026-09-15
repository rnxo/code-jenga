"use client";

import { useEffect, useRef } from "react";

// リザルト画面に入った瞬間に出す土下座動画のポップアップ。担当: FE-B
// 再生が終わるか、閉じるボタン／背景クリック／Esc で消える。
// 開閉は呼び出し側（ResultPanel）が持ち、「もう一度見る」ボタンから再表示できる。
// 動画は public/videos/dogeza.mp4（H.264 / AAC、約 7.5 秒）。

const DOGEZA_VIDEO_SRC = "/videos/dogeza.mp4";

export interface DogezaPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DogezaPopup({ isOpen, onClose }: DogezaPopupProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    // 再表示のときも頭から流す。自動再生がブロックされても、ポップアップは残して手で再生できるようにする
    video.currentTime = 0;
    video.play().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`土下座動画の自動再生に失敗しました: ${message}`);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="土下座"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border-4 border-amber-300 bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg font-bold text-white transition-colors hover:bg-black/80"
        >
          ×
        </button>
        <video
          ref={videoRef}
          src={DOGEZA_VIDEO_SRC}
          className="block w-full"
          controls
          playsInline
          onEnded={onClose}
          onError={() => {
            console.error(
              `土下座動画を読み込めませんでした: ${DOGEZA_VIDEO_SRC}`,
            );
            onClose();
          }}
        />
      </div>
    </div>
  );
}
