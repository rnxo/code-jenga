// スタート画面のタイトルアート。
// 「Gemini が作ったコードがタワーで、そこから1行抜く」というゲームの説明を、
// 文章より先に見た目で伝えるための飾り。操作はできない。

const LINES = [
  'console.log(total + tax);',
  'const tax = total * 0.1;',
  'orders.forEach(add);',
  'let total = 0;',
  'const orders = [120, 340];',
];

/** 抜かれて浮いている段（下から数えたときの位置） */
const PULLED_INDEX = 2;

export function TowerArt() {
  return (
    <div aria-hidden className="mb-8 select-none">
      <div className="jenga-sway flex flex-col gap-1.5">
        {LINES.map((line, i) => {
          // 上から描くので、下からの段数に直す
          const fromBottom = LINES.length - 1 - i;
          const pulled = fromBottom === PULLED_INDEX;

          return (
            <div
              key={line}
              className={
                pulled
                  ? "jenga-slip flex h-8 w-3/5 items-center gap-2 rounded-sm bg-amber-400 px-3 shadow-lg shadow-black/50 ring-2 ring-red-400"
                  : `flex h-8 items-center gap-2 rounded-sm px-3 shadow-md shadow-black/40 ${
                      i % 2 === 0 ? "bg-amber-600" : "bg-amber-700"
                    }`
              }
              style={pulled ? undefined : { marginLeft: `${(i % 3) - 1}px` }}
            >
              <span className="shrink-0 font-mono text-[10px] text-black/40">
                {String(fromBottom + 1).padStart(2, "0")}
              </span>
              <span className="truncate font-mono text-[11px] text-black/70">
                {line}
              </span>
            </div>
          );
        })}
      </div>

      {/* 台 */}
      <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
    </div>
  );
}
