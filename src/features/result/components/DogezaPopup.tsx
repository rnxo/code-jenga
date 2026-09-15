"use client";

import { useEffect, useRef, useState } from "react";

// リザルト画面に入った瞬間に出す土下座動画のポップアップ。担当: FE-B
// 再生が終わるか、閉じるボタン／背景クリック／Esc で消える。
// 動画は public/videos/dogeza.mp4（H.264 / AAC、約 7.5 秒）。

const DOGEZA_VIDEO_SRC = "/videos/dogeza.mp4";

export function DogezaPopup() {
  const [isOpen, setIsOpen] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (!video) return;

    // 自動再生がブロックされた場合でも、ポップアップ自体は残して手で再生できるようにする
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
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border-4 border-amber-300 bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="閉じる"
          onClick={() => setIsOpen(false)}
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
          onEnded={() => setIsOpen(false)}
          onError={() => {
            console.error(`土下座動画を読み込めませんでした: ${DOGEZA_VIDEO_SRC}`);
            setIsOpen(false);
          }}
        />
      </div>
    </div>
  );
}
