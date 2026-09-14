// 合言葉を思いつくのは意外と手が止まるので、その場で振れるようにする。
//
// 口で伝えることが前提なので、聞き間違いやすい文字を実際に排除している:
//   - 単語に o / l を含めない（0・1 と紛れる）
//   - 数字は 2〜9 だけを使う（0 と o、1 と l が紛れる）
// 合言葉は joinRoom で完全一致検索に使うので、1文字の聞き間違いがそのまま
// 「部屋が見つかりません」になる。

const WORDS = [
  "jenga",
  "stack",
  "crash",
  "brace",
  "amber",
  "brick",
  "timber",
  "wedge",
  "quake",
  "truss",
  "beam",
  "nudge",
];

const DIGITS = "23456789";

export function randomPassphrase() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const number = Array.from(
    { length: 3 },
    () => DIGITS[Math.floor(Math.random() * DIGITS.length)],
  ).join("");

  return `${word}-${number}`;
}
