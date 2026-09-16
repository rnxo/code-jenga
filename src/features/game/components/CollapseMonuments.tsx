"use client";

import styles from "./JengaTower.module.css";

// 崩壊が終わったあと、瓦礫の奥から像が「バン」と飛び出してくる。
//
// 出てくるのは勝敗で決まる1体だけ。勝ちなら自由の女神、負けなら奈良の大仏。
// 2体並べて片方を暗くしていた頃より、どちらだったのかが一目で分かる。
// 勝敗が分からないとき（観戦・未サインインなど）だけ、両方を並べて出す。
//
// ゲームの進行には一切関与しない完全な飾り。絵はインライン SVG なので画像ファイルは持たない。

function LibertySvg() {
  return (
    <svg viewBox="0 0 64 128" className={styles.monumentSvg} role="img" aria-label="自由の女神">
      <defs>
        <linearGradient id="pukeGradientLiberty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="20%" stopColor="#f97316" />
          <stop offset="40%" stopColor="#facc15" />
          <stop offset="60%" stopColor="#22c55e" />
          <stop offset="80%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
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
      </g>

      {/* 頭ごと振る。冠・顔・舌・吐瀉物をひとまとめにして、首のあたりを軸に回す */}
      <g className={`${styles.monumentHead} ${styles.monumentHeadLiberty}`}>
        <g fill="currentColor">
          {/* 頭と冠 */}
          <circle cx="32" cy="35" r="8" />
          <path d="M32 21 l2.5 7 h-5 Z" />
          <path d="M24 24 l4 6 -5.5 -1.5 Z" />
          <path d="M40 24 l-4 6 5.5 -1.5 Z" />
          <path d="M19 30 l5 4 -6 0.5 Z" />
          <path d="M45 30 l-5 4 6 0.5 Z" />
        </g>
        {/* 顔の面。シルエットより明るくして目鼻立ちが乗るようにする */}
        <ellipse cx="32" cy="35.5" rx="6.3" ry="6.9" fill="#9ec9bb" />
        {/* 生え際 */}
        <path d="M25.8 33.6 Q32 27.6 38.2 33.6 Q35 30.6 32 30.4 Q29 30.6 25.8 33.6 Z" fill="#3f6d5f" />
        {/* 目 */}
        <ellipse cx="29.4" cy="34.4" rx="1.5" ry="1.7" fill="#ffffff" />
        <ellipse cx="34.6" cy="34.4" rx="1.5" ry="1.7" fill="#ffffff" />
        <circle className={styles.pupil} cx="29.6" cy="34.6" r="0.85" fill="#22352f" />
        <circle className={styles.pupil} cx="34.8" cy="34.6" r="0.85" fill="#22352f" />
        {/* 白目を剥いたあとの下まぶた */}
        <path
          className={styles.eyeRolled}
          d="M28.1 35.4 Q29.5 36.5 30.8 35.4"
          fill="none"
          stroke="#22352f"
          strokeWidth="0.45"
          strokeLinecap="round"
        />
        <path
          className={styles.eyeRolled}
          d="M33.4 35.4 Q34.7 36.5 36.1 35.4"
          fill="none"
          stroke="#22352f"
          strokeWidth="0.45"
          strokeLinecap="round"
        />
        {/* まゆ */}
        <path d="M27.5 31.9 Q29.4 30.9 31.3 31.8" fill="none" stroke="#22352f" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M32.7 31.8 Q34.6 30.9 36.5 31.9" fill="none" stroke="#22352f" strokeWidth="0.7" strokeLinecap="round" />
        {/* 鼻 */}
        <path d="M32 35.6 L32 37.1 L33 37.5" fill="none" stroke="#22352f" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* 誇らしげな笑み */}
        <path d="M29.7 39.2 Q32 41.4 34.3 39.2" fill="none" stroke="#22352f" strokeWidth="0.9" strokeLinecap="round" />
        {/* 出した舌 */}
        <path d="M30.2 39.7 Q30.1 47.2 32 49.4 Q33.9 47.2 34 39.7 Z" fill="#e2706a" stroke="#b9524c" strokeWidth="0.3" strokeLinejoin="round" />
        {/* 虹色の吐瀉物。口から下へ流れ続ける */}
        <g className={styles.puke}>
          <path
            d="M30.1 41 Q27.6 74 25.8 128 L38.2 128 Q36.4 74 33.9 41 Z"
            fill="url(#pukeGradientLiberty)"
            opacity="0.9"
          />
          <ellipse className={styles.pukeDrop} cx="28.6" cy="56" rx="1.9" ry="2.5" fill="#f97316" />
          <ellipse className={styles.pukeDropB} cx="34.4" cy="62" rx="1.6" ry="2.2" fill="#22c55e" />
          <ellipse className={styles.pukeDropC} cx="31" cy="70" rx="2.1" ry="2.8" fill="#3b82f6" />
        </g>
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
      <defs>
        <radialGradient id="beamLeftBuddha" gradientUnits="userSpaceOnUse" cx="43.6" cy="42.6" r="130">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="12%" stopColor="#67e8f9" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="beamRightBuddha" gradientUnits="userSpaceOnUse" cx="52.4" cy="42.6" r="130">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="12%" stopColor="#67e8f9" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pukeGradientBuddha" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="20%" stopColor="#f97316" />
          <stop offset="40%" stopColor="#facc15" />
          <stop offset="60%" stopColor="#22c55e" />
          <stop offset="80%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <g className={styles.torsoSpin} fill="currentColor">
        {/* 蓮華座 */}
        <ellipse cx="48" cy="100" rx="36" ry="8" />
        <path d="M14 100 q12 -12 34 -12 q22 0 34 12 Z" />
        {/* 膝と組んだ足 */}
        <path d="M22 90 q26 -12 52 0 Z" />
        {/* 体 */}
        <path d="M30 90 q-2 -34 18 -34 q20 0 18 34 Z" />
        {/* 手（印を結ぶ） */}
        <ellipse cx="48" cy="80" rx="9" ry="4" />
      </g>

      {/* 頭ごと振る。顔・舌・吐瀉物をひとまとめにして、首のあたりを軸に回す */}
      <g className={`${styles.monumentHead} ${styles.monumentHeadBuddha}`}>
        <g fill="currentColor">
          {/* 頭 */}
          <circle cx="48" cy="44" r="15" />
          {/* 肉髻 */}
          <circle cx="48" cy="28" r="5" />
        </g>
        {/* 長い耳 */}
        <ellipse cx="34" cy="46" rx="2.6" ry="5.2" fill="#5c4d34" />
        <ellipse cx="62" cy="46" rx="2.6" ry="5.2" fill="#5c4d34" />
        {/* 顔の面 */}
        <ellipse cx="48" cy="45" rx="12" ry="12.6" fill="#9b8564" />
        {/* 螺髪の生え際 */}
        <path d="M36.8 39 Q48 30.8 59.2 39 Q54 34.8 48 34.5 Q42 34.8 36.8 39 Z" fill="#584a33" />
        {/* 伏せたまぶた */}
        {/* 目から出すビーム。白目を剥いたあとに撃ち始める */}
        <g className={styles.eyeBeam}>
          <path d="M43.6 42.6 L-90 22 L-90 63 Z" fill="url(#beamLeftBuddha)" />
          <path d="M52.4 42.6 L186 22 L186 63 Z" fill="url(#beamRightBuddha)" />
        </g>
        {/* 吐き始めたら剥く白目。まぶたの線より先に描いて、線が下まぶたに見えるようにする */}
        <ellipse className={styles.eyeRolled} cx="43.6" cy="42.6" rx="4.1" ry="3.2" fill="#f8f6f0" />
        <ellipse className={styles.eyeRolled} cx="52.4" cy="42.6" rx="4.1" ry="3.2" fill="#f8f6f0" />
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
        {/* 出した舌 */}
        <path d="M45.6 52.4 Q45.2 64.4 48 67.6 Q50.8 64.4 50.4 52.4 Z" fill="#c96a63" stroke="#8f4740" strokeWidth="0.4" strokeLinejoin="round" />
        {/* 虹色の吐瀉物。口から下へ流れ続ける */}
        <g className={styles.puke}>
          <path
            d="M45.3 54 Q41.6 82 39.4 112 L56.6 112 Q54.4 82 50.7 54 Z"
            fill="url(#pukeGradientBuddha)"
            opacity="0.9"
          />
          <ellipse className={styles.pukeDrop} cx="43.6" cy="72" rx="2.6" ry="3.4" fill="#f97316" />
          <ellipse className={styles.pukeDropB} cx="52.4" cy="80" rx="2.2" ry="3" fill="#22c55e" />
          <ellipse className={styles.pukeDropC} cx="47.8" cy="90" rx="2.9" ry="3.8" fill="#3b82f6" />
        </g>
      </g>
    </svg>
  );
}

/** 見ている人の勝敗。null なら勝敗を出さず、像だけ立てる */
export type CollapseVerdict = "win" | "lose";

/**
 * 着弾の演出。像にくっついて出る、足もとの輪と背後の閃光。
 *
 * 像は盤面では本文の後ろ（z-index: -1）に置いてあるので、これだけだと
 * 盤面では衝撃がほとんど見えない。盤面用の広いほうは ImpactOverlay が持つ。
 */
function Impact() {
  return (
    <>
      <span className={styles.monumentFlash} />
      <span className={styles.monumentShock} />
      <span className={`${styles.monumentShock} ${styles.monumentShockLate}`} />
      <span className={`${styles.monumentShock} ${styles.monumentShockLatest}`} />
    </>
  );
}

/**
 * 画面いっぱいに広がる着弾の演出。
 *
 * 像そのものは本文の後ろに置く必要がある（前に出すとコードと削除ボタンを
 * 覆ってしまう。#39 のレビュー）。一方で衝撃は前に出ないと見えない。
 * そこで、消えてなくなるものだけをこの層に分けて本文の前に出す。
 *
 * 結果画面でもカードの枠を越えて画面全体に広がる（position: fixed）。
 * pointer-events: none なので、出ている間もクリックは下へ抜ける。
 */
function ImpactOverlay() {
  return (
    <span aria-hidden className={styles.impactOverlay}>
      <span className={styles.impactFlash} />
      <span className={styles.impactRing} />
      <span className={`${styles.impactRing} ${styles.impactRingLate}`} />
      <span className={`${styles.impactRing} ${styles.impactRingLatest}`} />
    </span>
  );
}

export interface CollapseMonumentsProps {
  /** 結果画面の小さいタワーに重ねるとき。像も小さくして枠に収める */
  compact?: boolean;
  /**
   * 見ている人の勝敗。勝ちなら自由の女神、負けなら奈良の大仏が1体だけ出る。
   * 渡さなければ（勝敗が分からなければ）両方を並べて出す。
   */
  verdict?: CollapseVerdict | null;
}

export function CollapseMonuments({
  compact = false,
  verdict = null,
}: CollapseMonumentsProps) {
  // 勝敗が分かっていれば、その側だけ。分からなければ両方
  const showLiberty = verdict !== "lose";
  const showBuddha = verdict !== "win";
  const isSingle = verdict !== null;

  return (
    <>
      {/*
        * 衝撃は結果画面でも画面いっぱいに出す。position: fixed なので、
        * 結果カードの枠を越えて画面全体に広がる。
        */}
      {isSingle ? <ImpactOverlay /> : null}
    <div
      aria-hidden
      className={[
        styles.monuments,
        compact ? styles.monumentsCompact : styles.monumentsFullscreen,
        // 1体だけのときは真ん中に据える（2体のときは左右に振り分ける）
        isSingle ? styles.monumentsSingle : "",
        // 着弾で画面を揺らす。揺れるのはこの層だけで、本文のレイアウトには触らない
        isSingle ? styles.monumentsQuake : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showLiberty ? (
      <figure
        className={[
          styles.monument,
          styles.monumentLiberty,
          // 1体だけなら、ためを置かずに飛び出す
          isSingle ? styles.monumentSolo : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* 掲げた銘板の位置に札を重ねて、女神が持っているように見せる */}
        <span className={styles.monumentBody}>
          {isSingle ? <Impact /> : null}
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
      ) : null}

      {showBuddha ? (
      <figure
        className={[
          styles.monument,
          styles.monumentBuddha,
          isSingle ? styles.monumentSolo : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* 印を結んだ手のあたりに札を重ねて、大仏が掲げているように見せる */}
        <span className={styles.monumentBody}>
          {isSingle ? <Impact /> : null}
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
      ) : null}
    </div>
    </>
  );
}
