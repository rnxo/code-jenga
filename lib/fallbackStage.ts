// GEMINI_API_KEY が無いときに使う、作り置きの舞台。
// Gemini がいなくてもゲームの流れを確認できるようにするためのもの。

export interface Stage {
  title: string;
  lines: string[];
  comment: string;
}

const STAGES: Stage[] = [
  {
    title: "発注書の集計",
    lines: [
      '  const orders = [120, 340, 90, 560];',
      '  const taxRate = 0.1;',
      '  const label = "合計";',
      '  let total = 0;',
      '  orders.forEach((price) => { total += price; });',
      '  const tax = Math.round(total * taxRate);',
      '  const withTax = total + tax;',
      '  console.log(label + ": " + total + "円");',
      '  console.log("消費税: " + tax + "円");',
      '  console.log("税込: " + withTax + "円");',
      '  const average = Math.round(total / orders.length);',
      '  console.log("平均単価: " + average + "円");',
    ],
    comment:
      "在庫のない発注書です。合計を出すまでに何度も同じ値を参照しています。どこが土台か、よく見てから抜いてください。",
  },
  {
    title: "部室の鍵当番",
    lines: [
      '  const members = ["あおい", "はると", "ゆい", "そら"];',
      '  const week = ["月", "火", "水", "木"];',
      '  const duties = [];',
      '  members.forEach((name, i) => { duties.push(week[i] + ": " + name); });',
      '  const first = duties[0];',
      '  const last = duties[duties.length - 1];',
      '  console.log("今週の当番表");',
      '  duties.forEach((line) => { console.log(line); });',
      '  console.log("最初: " + first);',
      '  console.log("最後: " + last);',
      '  console.log("人数: " + members.length + "人");',
    ],
    comment:
      "当番表を組み立てるだけの素直なコードです。ただし配列を用意する行を抜くと、そのあとが総崩れになります。",
  },
];

export function pickFallbackStage(): Stage {
  return STAGES[Math.floor(Math.random() * STAGES.length)];
}
