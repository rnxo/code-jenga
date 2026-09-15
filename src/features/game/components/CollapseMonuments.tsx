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

      {/* 顔。勝ち側なので誇らしげに。ゆっくり横に揺れる */}
      <g className={styles.monumentFace}>
        {/* 顔の面。シルエットより明るくして目鼻立ちが乗るようにする */}
        <ellipse cx="32" cy="35.5" rx="6.3" ry="6.9" fill="#9ec9bb" />
        {/* 生え際 */}
        <path d="M25.8 33.6 Q32 27.6 38.2 33.6 Q35 30.6 32 30.4 Q29 30.6 25.8 33.6 Z" fill="#3f6d5f" />
        {/* 目 */}
        <ellipse cx="29.4" cy="34.4" rx="1.5" ry="1.7" fill="#ffffff" />
        <ellipse cx="34.6" cy="34.4" rx="1.5" ry="1.7" fill="#ffffff" />
        <circle cx="29.6" cy="34.6" r="0.85" fill="#22352f" />
        <circle cx="34.8" cy="34.6" r="0.85" fill="#22352f" />
        {/* まゆ */}
        <path d="M27.5 31.9 Q29.4 30.9 31.3 31.8" fill="none" stroke="#22352f" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M32.7 31.8 Q34.6 30.9 36.5 31.9" fill="none" stroke="#22352f" strokeWidth="0.7" strokeLinecap="round" />
        {/* 鼻 */}
        <path d="M32 35.6 L32 37.1 L33 37.5" fill="none" stroke="#22352f" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* 誇らしげな笑み */}
        <path d="M29.7 39.2 Q32 41.4 34.3 39.2" fill="none" stroke="#22352f" strokeWidth="0.9" strokeLinecap="round" />
        {/* ほお */}
        <ellipse cx="27.9" cy="37.7" rx="1.1" ry="0.7" fill="#e8907d" opacity="0.5" />
        <ellipse cx="36.1" cy="37.7" rx="1.1" ry="0.7" fill="#e8907d" opacity="0.5" />
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

      {/* 顔。負け側なので、伏し目でいたわる表情に。女神とずらして揺らす */}
      <g className={`${styles.monumentFace} ${styles.monumentFaceSlow}`}>
        {/* 長い耳 */}
        <ellipse cx="34" cy="46" rx="2.6" ry="5.2" fill="#5c4d34" />
        <ellipse cx="62" cy="46" rx="2.6" ry="5.2" fill="#5c4d34" />
        {/* 顔の面 */}
        <ellipse cx="48" cy="45" rx="12" ry="12.6" fill="#9b8564" />
        {/* 螺髪の生え際 */}
        <path d="M36.8 39 Q48 30.8 59.2 39 Q54 34.8 48 34.5 Q42 34.8 36.8 39 Z" fill="#584a33" />
        {/* 伏せたまぶた */}
        <path d="M39.8 43.2 Q43.6 46.8 47.4 43.2" fill="none" stroke="#2c2519" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M48.6 43.2 Q52.4 46.8 56.2 43.2" fill="none" stroke="#2c2519" strokeWidth="1.3" strokeLinecap="round" />
        {/* まゆ */}
        <path d="M38.8 39.4 Q43.2 37.5 47.2 39.2" fill="none" stroke="#2c2519" strokeWidth="1" strokeLinecap="round" />
        <path d="M48.8 39.2 Q52.8 37.5 57.2 39.4" fill="none" stroke="#2c2519" strokeWidth="1" strokeLinecap="round" />
        {/* 白毫 */}
        <circle cx="48" cy="40.8" r="1.2" fill="#f4e6c8" />
        {/* 鼻と口 */}
        <path d="M48 45.6 L48 48.4 L49.5 49" fill="none" stroke="#2c2519" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M44.8 51.8 Q48 53.9 51.2 51.8" fill="none" stroke="#2c2519" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 見ている人の勝敗。null なら勝敗を出さず、像だけ立てる */
export type CollapseVerdict = "win" | "lose";

export interface CollapseMonumentsProps {
  /** 結果画面の小さいタワーに重ねるとき。像も小さくして枠に収める */
  compact?: boolean;
  /**
   * 見ている人の勝敗。自由の女神が勝ち側、奈良の大仏が負け側を持ち、
   * 自分の側だけが明るく立つ。渡さなければ両方が同じ明るさで並ぶ。
   */
  verdict?: CollapseVerdict | null;
}

export function CollapseMonuments({
  compact = false,
  verdict = null,
}: CollapseMonumentsProps) {
  // 自分の側だけを立たせる。勝敗が分からないときは両方そのまま出す
  const libertyDimmed = verdict === "lose";
  const buddhaDimmed = verdict === "win";
  return (
    <div
      aria-hidden
      className={[
        styles.monuments,
        compact ? styles.monumentsCompact : styles.monumentsFullscreen,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <figure
        className={[
          styles.monument,
          styles.monumentLiberty,
          libertyDimmed ? styles.monumentDimmed : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* 掲げた銘板の位置に札を重ねて、女神が持っているように見せる */}
        <span className={styles.monumentBody}>
          <LibertySvg />
          <span
            className={`${styles.verdictBadge} ${styles.verdictWin} ${styles.verdictOnLiberty}`}
          >
            <span className={styles.verdictLabel}>win</span>
            <span className={styles.verdictText}>勝ち</span>
          </span>
        </span>
        <figcaption className={styles.monumentCaption}>自由の女神</figcaption>
      </figure>

      <figure
        className={[
          styles.monument,
          styles.monumentBuddha,
          buddhaDimmed ? styles.monumentDimmed : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* 印を結んだ手のあたりに札を重ねて、大仏が掲げているように見せる */}
        <span className={styles.monumentBody}>
          <DaibutsuSvg />
          <span
            className={`${styles.verdictBadge} ${styles.verdictLose} ${styles.verdictOnBuddha}`}
          >
            <span className={styles.verdictLabel}>lose</span>
            <span className={styles.verdictText}>負け</span>
          </span>
        </span>
        <figcaption className={styles.monumentCaption}>奈良の大仏</figcaption>
      </figure>
    </div>
  );
}
