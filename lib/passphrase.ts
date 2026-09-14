// 合言葉を思いつくのは意外と手が止まるので、その場で振れるようにする。
// 口で伝えることが前提なので、紛らわしい文字（0/o、1/l）は使わない。

const WORDS = [
  "tower",
  "jenga",
  "block",
  "stack",
  "pull",
  "crash",
  "brace",
  "wobble",
  "amber",
  "mosa",
];

export function randomPassphrase() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const number = String(Math.floor(Math.random() * 900) + 100);
  return `${word}-${number}`;
}
