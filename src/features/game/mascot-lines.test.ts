import { describe, expect, it } from "vitest";
import { pickMascotLine, type MascotSituation } from "./mascot-lines";

// セリフ表の見張り。煽りを足したので、出どころと当たりの強さをここで固めておく。

const SITUATIONS: MascotSituation[] = [
  "my_turn",
  "selected",
  "blocked",
  "hurry",
  "waiting",
  "safe_mine",
  "safe_opponent",
  "idle",
  "title",
];

/** その状況で出うるセリフを全部集める（ランダムなので回数で引き当てる） */
function allLinesFor(situation: MascotSituation) {
  const seen = new Map<string, string>();
  for (let i = 0; i < 400; i += 1) {
    const line = pickMascotLine(situation);
    seen.set(line.message, line.mood);
  }
  return seen;
}

describe("pickMascotLine", () => {
  it("どの状況でもセリフが返る", () => {
    for (const situation of SITUATIONS) {
      const line = pickMascotLine(situation);
      expect(line.message.length).toBeGreaterThan(0);
      expect(["idle", "smug", "panic"]).toContain(line.mood);
    }
  });

  it("直前と同じセリフは避ける", () => {
    for (const situation of SITUATIONS) {
      const first = pickMascotLine(situation);
      for (let i = 0; i < 40; i += 1) {
        expect(pickMascotLine(situation, first.message).message).not.toBe(first.message);
      }
    }
  });

  it("候補が1つしかない状況でも、前回を避けきれずに落ちたりしない", () => {
    // 候補を全部 previous に指定しても、必ず何か返る
    for (const situation of SITUATIONS) {
      for (const message of allLinesFor(situation).keys()) {
        expect(pickMascotLine(situation, message).message.length).toBeGreaterThan(0);
      }
    }
  });

  it("どの状況にも煽りが混ざっている（ふつうのセリフだけにならない）", () => {
    for (const situation of SITUATIONS) {
      // 状況ごとに2件以上の候補があり、煽りを足したぶん増えている
      expect(allLinesFor(situation).size).toBeGreaterThanOrEqual(4);
    }
  });

  it("煽りでも、刺すのはプレイとコードだけにする", () => {
    // 人となり・見た目・属性に踏み込む言い回しを入れない見張り。
    // 遊んでいる本人に向く言葉なので、ここは機械的に弾いておく。
    const forbidden = [
      "バカ", "ばか", "アホ", "あほ", "馬鹿", "無能", "clown",
      "きもい", "キモい", "ブス", "デブ", "死ね", "消えろ", "うざい", "ウザい",
      "才能ない", "向いてない",
    ];
    for (const situation of SITUATIONS) {
      for (const message of allLinesFor(situation).keys()) {
        for (const word of forbidden) {
          expect(message, `${situation}: ${message}`).not.toContain(word);
        }
      }
    }
  });

  it("煽りは smug か panic で喋る（にこやかに毒を吐かない）", () => {
    // 「実力じゃなくて」のような煽り文句が idle 声で出ると、ただ不気味になる
    const taunts = ["実力じゃなくて", "逆に", "君と違って", "たまたま", "固まってる"];
    for (const situation of SITUATIONS) {
      for (const [message, mood] of allLinesFor(situation)) {
        if (taunts.some((t) => message.includes(t))) {
          expect(mood, message).not.toBe("idle");
        }
      }
    }
  });
});
