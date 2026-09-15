"use client";

import styles from "./JengaTower.module.css";

// 崩壊が終わったあと、瓦礫の奥から自由の女神と奈良の大仏がせり上がってくる。
// ゲームの進行には一切関与しない完全な飾り。絵はインライン SVG なので画像ファイルは持たない。

function LibertySvg() {
  return (
    <svg viewBox="0 0 64 128" className={styles.monumentSvg} role="img" aria-label="自由の女神">
      <g fill="currentColor">
        {/* 台座 */}
        <rect x="16" y="112" width="32" height="12" rx="1.5" />
        <rect x="21" y="102" width="22" height="11" />
        {/* 衣 */}
        <path d="M27 44 L37 44 L45 104 L19 104 Z" />
        {/* 掲げた腕とたいまつ */}
        <path d="M37 48 L42 22 L47 23 L42 49 Z" />
        <path d="M40 22 h9 l-4.5 -13 Z" />
        {/* もう一方の腕（銘板） */}
        <path d="M27 52 L20 62 L24 66 L30 57 Z" />
        {/* 頭と冠 */}
        <circle cx="32" cy="35" r="8" />
        <path d="M32 21 l2.5 7 h-5 Z" />
        <path d="M24 24 l4 6 -5.5 -1.5 Z" />
        <path d="M40 24 l-4 6 5.5 -1.5 Z" />
        <path d="M19 30 l5 4 -6 0.5 Z" />
        <path d="M45 30 l-5 4 6 0.5 Z" />
      </g>
    </svg>
  );
}

function DaibutsuSvg() {
  return (
    <svg viewBox="0 0 96 112" className={styles.monumentSvg} role="img" aria-label="奈良の大仏">
      <g fill="currentColor">
        {/* 蓮華座 */}
        <ellipse cx="48" cy="100" rx="36" ry="8" />
        <path d="M14 100 q12 -12 34 -12 q22 0 34 12 Z" />
        {/* 膝と組んだ足 */}
        <path d="M22 90 q26 -12 52 0 Z" />
        {/* 体 */}
        <path d="M30 90 q-2 -34 18 -34 q20 0 18 34 Z" />
        {/* 手（印を結ぶ） */}
        <ellipse cx="48" cy="80" rx="9" ry="4" />
        {/* 頭 */}
        <circle cx="48" cy="44" r="15" />
        {/* 肉髻 */}
        <circle cx="48" cy="28" r="5" />
      </g>
    </svg>
  );
}

export interface CollapseMonumentsProps {
  /** 結果画面の小さいタワーに重ねるとき。像も小さくして枠に収める */
  compact?: boolean;
}

export function CollapseMonuments({ compact = false }: CollapseMonumentsProps) {
  return (
    <div
      aria-hidden
      className={`${styles.monuments} ${compact ? styles.monumentsCompact : ""}`}
    >
      <figure className={`${styles.monument} ${styles.monumentLiberty}`}>
        <LibertySvg />
        <figcaption className={styles.monumentCaption}>自由の女神</figcaption>
      </figure>
      <figure className={`${styles.monument} ${styles.monumentBuddha}`}>
        <DaibutsuSvg />
        <figcaption className={styles.monumentCaption}>奈良の大仏</figcaption>
      </figure>
    </div>
  );
}
