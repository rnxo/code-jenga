"use client";

import { useEffect, useRef } from "react";

export interface OsekkaikunBackgroundProps {
  /**
   * 背景に敷く絵。渡さなければ、おせっかいくん。
   * トップページは洋楽のジャケットふうの絵に差し替えている（#42 の背景そのもの
   * ではなくなるが、部品は残してあるので src を外せば戻る）。
   */
  src?: string;
  /** 濃さ。絵によって沈み方が違うので、呼び出し側で決められるようにする */
  opacity?: number;
  /** 一辺の最大の長さ（px）。ジャケットは正方形なので大きめに出したい */
  maxSizePx?: number;
  /**
   * 重ね方。おせっかいくんは線画なので multiply で紙に刷ったように乗るが、
   * 写真を multiply で敷くと明るい紙に負けて真っ白に飛ぶ。写真は normal。
   */
  blend?: "multiply" | "normal";
}

export function OsekkaikunBackground({
  src = "/images/osekkaikun.png",
  opacity = 0.15,
  maxSizePx = 700,
  blend = "multiply",
}: OsekkaikunBackgroundProps = {}) {
  const imageRef = useRef<HTMLImageElement>(null);

  const targetX = useRef(0);
  const targetY = useRef(0);

  const currentX = useRef(0);
  const currentY = useRef(0);

  const animationFrame = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // 画面中央を0として、-1〜1に変換
      targetX.current = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY.current = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const animate = (time: number) => {
      if (!startTime.current) {
        startTime.current = time;
      }

      const elapsed = time - startTime.current;

      // マウス位置へゆっくり追従
      currentX.current +=
        (targetX.current - currentX.current) * 0.015;

      currentY.current +=
        (targetY.current - currentY.current) * 0.015;

      const image = imageRef.current;

      if (image) {
        // ゆっくりした揺れ
        const floatingX = Math.sin(elapsed * 0.00035) * 20;
        const floatingY = Math.cos(elapsed * 0.00028) * 16;

        // マウス位置による移動
        const mouseX = currentX.current * 35;
        const mouseY = currentY.current * 35;

        // 時間とともに少しずつ拡大
        const scale = 1 + Math.min(elapsed / 120000, 0.12);

        image.style.transform = `
          translate(
            ${floatingX + mouseX}px,
            ${floatingY + mouseY}px
          )
          scale(${scale})
        `;
      }

      animationFrame.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);

      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <img
        ref={imageRef}
        src={src}
        alt=""
        style={{ width: `min(${maxSizePx}px, 92vw)`, opacity, mixBlendMode: blend }}
        className="absolute left-1/2 top-1/2 h-auto -translate-x-1/2 -translate-y-1/2 rounded-sm shadow-2xl will-change-transform"
      />
    </div>
  );
}