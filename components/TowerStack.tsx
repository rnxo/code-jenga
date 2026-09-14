"use client";

import { useRef, useState } from "react";
import type { Block } from "@/lib/types";

// タワーの描画。各段を CSS の直方体として組み、カメラごと回せるようにする。
// 文字は前面にだけ置くので、立体にしても読みやすさは落ちない。

const PULL_ANIMATION_MS = 550;

/** 木口の色。段ごとに変えて、木を積んでいるように見せる */
const FACE = ["#d97706", "#b45309", "#c2620a", "#a8480a"];

const DEFAULT_RX = 4;
const DEFAULT_RY = -14;

export function TowerStack({
  blocks,
  mode = "play",
  canPull = false,
  wobbly = false,
  onPull,
}: {
  blocks: Block[];
  /** play=対戦中 / collapsing=いま崩れている / fallen=崩れたあとの山 */
  mode?: "play" | "collapsing" | "fallen";
  canPull?: boolean;
  /** Gemini が「グラグラ」と判定したら小刻みに揺らす */
  wobbly?: boolean;
  onPull?: (id: string) => void;
}) {
  const [pullingId, setPullingId] = useState<string | null>(null);

  // ドラッグで回す。文字が読めなくなるところまでは倒せないようにする
  const [angle, setAngle] = useState({ rx: DEFAULT_RX, ry: DEFAULT_RY });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    // ボタンの上では掴まない。捕捉するとボタンに click が届かなくなる
    if ((e.target as HTMLElement).closest("button")) return;

    drag.current = { x: e.clientX, y: e.clientY, ...angle };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setAngle({
      ry: clamp(drag.current.ry + dx * 0.35, -55, 55),
      rx: clamp(drag.current.rx - dy * 0.25, -10, 40),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

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
        {mode === "play" ? "タワーは空になりました" : "すべて抜き切りました。"}
      </p>
    );
  }

  return (
    <div
      className={`jenga-scene select-none pt-6 ${
        // 崩れる分の高さを確保する。終了画面は山を詰めて見せるので浅くてよい
        mode === "collapsing" ? "pb-44" : mode === "fallen" ? "pb-14" : "pb-6"
      }`}
    >
      <div
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setAngle({ rx: DEFAULT_RX, ry: DEFAULT_RY })}
        style={
          { "--rx": `${angle.rx}deg`, "--ry": `${angle.ry}deg` } as React.CSSProperties
        }
        className={`jenga-tower mx-auto flex w-full max-w-[26rem] flex-col gap-3 ${dragging ? "cursor-grabbing" : "cursor-grab"} ${
          !dragging && mode === "play" ? "is-idle" : ""
        } ${wobbly ? "is-wobbly" : ""}`}
      >
        {blocks.map((block, idx) => {
          const face = FACE[idx % FACE.length];
          // 崩れる最中は派手に散らし、終了画面では山として詰める
          const spread = mode === "fallen" ? 0.34 : 1;
          const pulling = block.id === pullingId;
          const pullable = canPull && !pullingId;

          return (
            <div
              key={block.id}
              style={
                {
                  "--jenga-face": face,
                  // 崩れ方は段ごとに散らす（見た目だけなので index から決める）。
                  // 高い段＝上にあるほど遠くまで落ちる
                  "--fall-x": `${((idx % 3) - 1) * 46 * spread}px`,
                  "--fall-y": `${(40 + (blocks.length - idx) * 16) * spread}px`,
                  "--fall-z": `${((idx % 4) - 1) * 44 * spread}px`,
                  "--fall-rx": `${26 + (idx % 3) * 22}deg`,
                  "--fall-rz": `${((idx % 5) - 2) * 14}deg`,
                  // 上から崩れていく
                  "--fall-delay": `${idx * 45}ms`,
                } as React.CSSProperties
              }
              className={`jenga-piece ${pulling ? "is-pulling" : ""} ${
                pullable ? "is-pullable" : ""
              } ${mode === "play" ? "" : "is-falling"} ${
                !canPull && mode === "play" ? "opacity-70" : ""
              }`}
            >
              {/* 見えない面も置いて、回したときに中が抜けないようにする */}
              <span className="jenga-face top" />
              <span className="jenga-face bottom" />
              <span className="jenga-face side" />
              <span className="jenga-face side side-left" />
              <span className="jenga-face back" />

              <span className="jenga-face front">
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
              </span>
            </div>
          );
        })}
      </div>

      {mode === "play" && (
        <p className="mt-5 text-center font-mono text-[10px] tracking-[0.15em] text-neutral-600 uppercase">
          drag to rotate · double-click to reset
        </p>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
