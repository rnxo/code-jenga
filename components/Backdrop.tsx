// 全画面共通の背景。
// 「暗い部屋に積み木の壁があり、1ブロック抜けた隙間から光が漏れている」という画。
// 装飾のための装飾ではなく、ゲームの説明そのものを背景にしている。
//
// 3層構成:
//   1. 地の色
//   2. 積み木の壁（SVG パターン。段ごとに半個ずらした市松＝実際の積み方）
//      中央はマスクで消して、文字が乗る場所を汚さない
//   3. 抜けた隙間から漏れる光（横一文字のスリット＋足元に溜まる暖色）

export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-neutral-950"
    >
      <svg className="absolute inset-0 size-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* 積み木の壁。180x64 の中に上下2段、下段を半個ずらす */}
          <pattern
            id="jenga-wall"
            width="180"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <g fill="rgba(255,255,255,0.014)" stroke="rgba(255,255,255,0.05)">
              <rect x="2" y="2" width="56" height="28" rx="2" />
              <rect x="62" y="2" width="56" height="28" rx="2" />
              <rect x="122" y="2" width="56" height="28" rx="2" />

              <rect x="-28" y="34" width="56" height="28" rx="2" />
              <rect x="32" y="34" width="56" height="28" rx="2" />
              <rect x="92" y="34" width="56" height="28" rx="2" />
              <rect x="152" y="34" width="56" height="28" rx="2" />
            </g>
          </pattern>

          {/* 中央ほど暗い＝壁が消える。文字の後ろを空けるためのマスク */}
          <radialGradient id="jenga-fade" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="45%" stopColor="#333" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>
          <mask id="jenga-mask">
            <rect width="100%" height="100%" fill="url(#jenga-fade)" />
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#jenga-wall)"
          mask="url(#jenga-mask)"
        />
      </svg>

      {/* 抜けた隙間から漏れる光。横一文字に走らせる */}
      <div className="absolute top-[38%] left-1/2 h-24 w-[min(46rem,90vw)] -translate-x-1/2 rounded-full bg-amber-500/14 blur-3xl" />
      <div className="absolute top-[38%] left-1/2 h-px w-[min(30rem,70vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" />

      {/* 足元に溜まる暖色 */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-amber-950/30 to-transparent" />
    </div>
  );
}
