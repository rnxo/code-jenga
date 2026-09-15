"use client";

import { useEffect, useRef } from "react";

export function OsekkaikunBackground() {
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
        src="/images/osekkaikun.png"
        alt=""
        className="absolute left-1/2 top-1/2 h-auto w-[min(700px,100%)] -translate-x-1/2 -translate-y-1/2 opacity-15 mix-blend-multiply will-change-transform"
      />
    </div>
  );
}