"use client";

import { useState } from "react";
import type { Block } from "@/lib/types";

// タワーの描画。コード行を木片として積む。
// play : 抜ける（抜いた1枚がスライドして消えてから、実際の削除が走る）
// fallen: 崩れたあと（時間差で落ちる）

const PULL_ANIMATION_MS = 450;

/** 木口の色。段ごとに少し変えて、木を積んでいるように見せる */
const FACE = ["#d97706", "#b45309", "#c2620a", "#a8480a"];

export function TowerStack({
  blocks,
  mode = "play",
  canPull = false,
  wobbly = false,
  onPull,
}: {
  blocks: Block[];
  mode?: "play" | "fallen";
  canPull?: boolean;
  /** Gemini が「グラグラ」と判定したら小刻みに揺らす */
  wobbly?: boolean;
  onPull?: (id: string) => void;
}) {
  // 抜けていく1枚は、アニメーションが終わるまで DOM に残す
  const [pullingId, setPullingId] = useState<string | null>(null);

  const handlePull = (id: string) => {
    if (!canPull || pullingId) return;
    setPullingId(id);
    window.setTimeout(() => {
      onPull?.(id);
      setPullingId(null);
    }, PULL_ANIMATION_MS);
  };

  if (blocks.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-neutral-500">
        {mode === "fallen" ? "すべて抜き切りました。" : "タワーは空になりました"}
      </p>
    );
  }

  return (
    <div
      className={`jenga-stack flex flex-col gap-2 pt-2 pr-3 ${wobbly ? "is-wobbly" : ""}`}
    >
      {blocks.map((block, idx) => {
        const face = FACE[idx % FACE.length];
        const pulling = block.id === pullingId;
        const pullable = canPull && !pullingId;

        return (
          <div
            key={block.id}
            style={
              {
                "--jenga-face": face,
                background: face,
                // 崩れる向きは段ごとに散らす（見た目だけなので index から決める）
                "--fall-y": `${18 + idx * 6}px`,
                "--fall-x": `${((idx % 3) - 1) * 14}px`,
                "--fall-r": `${((idx % 5) - 2) * 3}deg`,
                "--fall-delay": `${idx * 55}ms`,
              } as React.CSSProperties
            }
            className={`jenga-block flex h-11 items-center gap-3 rounded-sm px-3 shadow-lg shadow-black/50 ${
              pulling ? "is-pulling" : ""
            } ${pullable ? "is-pullable" : ""} ${
              mode === "fallen" ? "is-falling" : ""
            } ${!canPull && mode === "play" ? "opacity-60" : ""}`}
          >
            <span className="shrink-0 font-mono text-[10px] text-black/40">
              {String(idx + 1).padStart(2, "0")}
            </span>

            <span className="truncate font-mono text-[13px] text-black/85">
              {block.code_snippet.trim()}
            </span>

            {mode === "play" && onPull && (
              <button
                onClick={() => handlePull(block.id)}
                disabled={!pullable}
                className="ml-auto shrink-0 cursor-pointer rounded-sm bg-black/25 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-black/70 uppercase transition hover:bg-black/40 disabled:cursor-not-allowed"
              >
                pull
              </button>
            )}
          </div>
        );
      })}

      {/* 台 */}
      <div className="mt-1 h-1.5 rounded-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
    </div>
  );
}
