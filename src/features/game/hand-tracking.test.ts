import { beforeEach, describe, expect, it } from "vitest";
import {
  advancePinch,
  consumePinch,
  estimateHandSize,
  isPinching,
  PINCH_HOLD_MS,
  resetPinch,
  toScreenRatio,
} from "./hand-tracking";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// カメラを繋がないと確かめられない部分なので、座標の計算だけここで固めておく。

function point(x: number, y: number): NormalizedLandmark {
  return { x, y, z: 0, visibility: 1 };
}

/** 21点のうち、つまみ判定で使う 0 / 4 / 8 / 9 だけ埋めた手 */
function hand(options: {
  wrist: [number, number];
  thumbTip: [number, number];
  indexTip: [number, number];
  middleMcp: [number, number];
}): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 21 }, () => point(0, 0));
  landmarks[0] = point(...options.wrist);
  landmarks[4] = point(...options.thumbTip);
  landmarks[8] = point(...options.indexTip);
  landmarks[9] = point(...options.middleMcp);
  return landmarks;
}

describe("toScreenRatio", () => {
  it("真ん中は真ん中のまま", () => {
    expect(toScreenRatio(point(0.5, 0.5))).toEqual({ x: 0.5, y: 0.5 });
  });

  it("左右を鏡写しにする（自分の右手を上げたら画面の右）", () => {
    const left = toScreenRatio(point(0.3, 0.5));
    const right = toScreenRatio(point(0.7, 0.5));
    expect(left.x).toBeGreaterThan(right.x);
  });

  it("上下はそのまま（手を下げたら画面の下）", () => {
    const top = toScreenRatio(point(0.5, 0.3));
    const bottom = toScreenRatio(point(0.5, 0.7));
    expect(top.y).toBeLessThan(bottom.y);
  });

  it("端まで手を伸ばさなくても画面の端に届く", () => {
    // 映像の 16% のところで、もう画面の端
    const topLeft = toScreenRatio(point(0.84, 0.16));
    expect(topLeft.x).toBeCloseTo(0, 6);
    expect(topLeft.y).toBeCloseTo(0, 6);

    const bottomRight = toScreenRatio(point(0.16, 0.84));
    expect(bottomRight.x).toBeCloseTo(1, 6);
    expect(bottomRight.y).toBeCloseTo(1, 6);
  });

  it("画面の外へははみ出さない", () => {
    const far = toScreenRatio(point(-0.5, 1.5));
    expect(far.x).toBeLessThanOrEqual(1);
    expect(far.y).toBeLessThanOrEqual(1);
    expect(far.x).toBeGreaterThanOrEqual(0);
    expect(far.y).toBeGreaterThanOrEqual(0);
  });
});

describe("isPinching", () => {
  const open = {
    wrist: [0.5, 0.9] as [number, number],
    middleMcp: [0.5, 0.7] as [number, number],
    thumbTip: [0.38, 0.6] as [number, number],
    indexTip: [0.56, 0.5] as [number, number],
  };

  it("指が開いていればつまんでいない", () => {
    expect(isPinching(hand(open))).toBe(false);
  });

  it("親指と人差し指が近づいたらつまんでいる", () => {
    expect(isPinching(hand({ ...open, thumbTip: [0.555, 0.505] }))).toBe(true);
  });

  it("カメラから離れても同じ判定になる（手の大きさで割っているため）", () => {
    // 手全体を半分の大きさにしても、つまみ具合は変わらない
    const half = (p: [number, number]): [number, number] => [
      0.5 + (p[0] - 0.5) / 2,
      0.5 + (p[1] - 0.5) / 2,
    ];
    const pinched = { ...open, thumbTip: [0.555, 0.505] as [number, number] };
    expect(
      isPinching(
        hand({
          wrist: half(pinched.wrist),
          middleMcp: half(pinched.middleMcp),
          thumbTip: half(pinched.thumbTip),
          indexTip: half(pinched.indexTip),
        }),
      ),
    ).toBe(true);
  });

  it("手の大きさが取れないときはつまんでいない扱い", () => {
    expect(
      isPinching(hand({ ...open, wrist: [0.5, 0.7], middleMcp: [0.5, 0.7] })),
    ).toBe(false);
  });
});

describe("advancePinch", () => {
  // モジュールに状態を持つので、毎回まっさらから始める
  beforeEach(() => {
    resetPinch();
  });

  it("つまんでいなければ 0 のまま", () => {
    expect(advancePinch(false, 0)).toBe(0);
    expect(advancePinch(false, 5_000)).toBe(0);
  });

  it("つまみ始めてから時間に応じて 1 まで満ちる", () => {
    expect(advancePinch(true, 1_000)).toBe(0);
    expect(advancePinch(true, 1_000 + PINCH_HOLD_MS / 2)).toBeCloseTo(0.5, 5);
    expect(advancePinch(true, 1_000 + PINCH_HOLD_MS)).toBe(1);
  });

  it("満ちても 1 を超えない", () => {
    advancePinch(true, 0);
    expect(advancePinch(true, PINCH_HOLD_MS * 10)).toBe(1);
  });

  it("確定したら、つまんだままでは二度と溜まらない（#49 レビュー 2）", () => {
    advancePinch(true, 0);
    expect(advancePinch(true, PINCH_HOLD_MS)).toBe(1);
    consumePinch();

    // 指を離さずに別の行へ流れても、勝手にもう一度確定しない
    expect(advancePinch(true, PINCH_HOLD_MS * 2)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS * 5)).toBe(0);
  });

  it("指をしっかり離せば、次のつまみは数え直せる", () => {
    advancePinch(true, 0);
    advancePinch(true, PINCH_HOLD_MS);
    consumePinch();

    // 猶予（取りこぼしとの区別）を超えて離す
    const released = PINCH_HOLD_MS + 400;
    expect(advancePinch(false, PINCH_HOLD_MS + 10)).toBe(0);
    expect(advancePinch(false, released)).toBe(0);

    // ここから数え直せる
    expect(advancePinch(true, released + 10)).toBe(0);
    expect(advancePinch(true, released + 10 + PINCH_HOLD_MS)).toBe(1);
  });

  it("一瞬だけ離れて見えたくらいでは、確定済みが解けない（連続して消えない）", () => {
    advancePinch(true, 0);
    advancePinch(true, PINCH_HOLD_MS);
    consumePinch();

    // 取りこぼし1フレームぶん（33ms）だけ離れて見えて、すぐ戻る
    expect(advancePinch(false, PINCH_HOLD_MS + 33)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS + 66)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS * 3)).toBe(0);
  });

  it("ねらわせない間にリセットすれば、溜めた時間は持ち越さない（#49 レビュー 3）", () => {
    advancePinch(true, 0);
    expect(advancePinch(true, PINCH_HOLD_MS * 0.9)).toBeCloseTo(0.9, 5);

    // 相手の手番のあいだは毎フレームここを通す
    resetPinch();

    // 手番が戻った最初のフレームで、いきなり確定しない
    expect(advancePinch(true, PINCH_HOLD_MS * 0.95)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 「つまんでいるのに反応しない」を防ぐための回帰。
// 実機で弱いと言われたのは、次の2つが重なっていたため。
//   1. 画面を指すと手のひらがカメラを向き、手首→中指の付け根が短く写って
//      比が跳ね上がる（見込み）
//   2. 0.7 秒のためが「21 フレーム連続成功」を要求していて、1 フレームの
//      取りこぼしで全部やり直しになる
// ---------------------------------------------------------------------------

/**
 * 手のひらをカメラへ tilt 度ぶん向けた手。
 * 向けるほど、手首→中指の付け根だけが短く写る（横幅は変わらない）。
 */
function tiltedHand(tiltDeg: number, pinchGap: number): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 21 }, () => point(0, 0));
  const palm = 0.22 * Math.cos((tiltDeg * Math.PI) / 180);
  landmarks[0] = point(0.5, 0.5 + palm); // 手首
  landmarks[9] = point(0.5, 0.5); // 中指の付け根
  landmarks[5] = point(0.5 - 0.085, 0.51); // 人差し指の付け根
  landmarks[17] = point(0.5 + 0.085, 0.51); // 小指の付け根
  landmarks[4] = point(0.5 - pinchGap / 2, 0.42); // 親指の先
  landmarks[8] = point(0.5 + pinchGap / 2, 0.42); // 人差し指の先
  return landmarks;
}

describe("手のひらをカメラに向けても、つまみ判定が効く", () => {
  beforeEach(() => {
    resetPinch();
  });

  it("画面を指す角度（0〜70度）のどこでも、つまめば反応する", () => {
    for (const tilt of [0, 30, 45, 60, 70]) {
      for (const gap of [0.02, 0.04]) {
        resetPinch();
        expect(isPinching(tiltedHand(tilt, gap)), `傾き${tilt}度 / すきま${gap}`).toBe(true);
      }
    }
  });

  it("手を開いていれば、どの角度でも反応しない（誤爆しない）", () => {
    for (const tilt of [0, 30, 45, 60, 70]) {
      resetPinch();
      expect(isPinching(tiltedHand(tilt, 0.14)), `傾き${tilt}度`).toBe(false);
    }
  });

  it("手の大きさの見積もりは、手のひらを向けても大きく崩れない", () => {
    const sizes = [0, 30, 45, 60, 70].map((tilt) => estimateHandSize(tiltedHand(tilt, 0.03)));
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    // 見込みで縮むのを横幅で補うので、端から端まで 1.1 倍以内に収まる
    expect(max / min).toBeLessThan(1.1);
  });

  it("しきい値ちょうどで震えても、つまむ／離すが高速で入れ替わらない", () => {
    resetPinch();
    // 入口を少し下回ってつまむ
    expect(isPinching(tiltedHand(0, 0.085))).toBe(true);
    // 少し戻した程度では離したことにしない（ヒステリシス）
    expect(isPinching(tiltedHand(0, 0.1))).toBe(true);
    // はっきり開けば離れる
    expect(isPinching(tiltedHand(0, 0.16))).toBe(false);
  });
});

describe("検出が時々すべっても、ためが振り出しに戻らない", () => {
  beforeEach(() => {
    resetPinch();
  });

  /** 30fps で dropRate の割合だけ取りこぼしながら、指をつまみ続ける */
  function holdWithDrops(dropRate: number, seconds: number, seed: number): boolean {
    let random = seed;
    const next = () => {
      // 再現できる疑似乱数（テストを揺らさない）
      random = (random * 1664525 + 1013904223) % 4294967296;
      return random / 4294967296;
    };
    const frames = Math.round(seconds * 30);
    for (let frame = 0; frame < frames; frame += 1) {
      const detected = next() >= dropRate;
      if (advancePinch(detected, (frame / 30) * 1000) >= 1) {
        return true;
      }
    }
    return false;
  }

  it("2割取りこぼしても、2秒つまみ続ければ確定する", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      resetPinch();
      expect(holdWithDrops(0.2, 2, seed), `seed ${seed}`).toBe(true);
    }
  });

  it("本当に指を離したら、猶予を過ぎた時点でためは消える", () => {
    resetPinch();
    const at = PINCH_HOLD_MS * 0.6;
    advancePinch(true, 0);
    expect(advancePinch(true, at)).toBeCloseTo(0.6, 5);

    // 離れて見えた瞬間の値で止まる（そこから先は進まない）
    expect(advancePinch(false, at)).toBeCloseTo(0.6, 5);
    expect(advancePinch(false, at + 100)).toBeCloseTo(0.6, 5);
    // 猶予を過ぎたら消える
    expect(advancePinch(false, at + 400)).toBe(0);
  });

  it("猶予だけでためが満ちることはない（手を離したのに確定しない）", () => {
    resetPinch();
    advancePinch(true, 0);
    advancePinch(true, PINCH_HOLD_MS * 0.95);
    // ここで離す。猶予のあいだ何度呼んでも 1 には届かない
    for (const t of [10, 50, 100, 150, 210]) {
      expect(advancePinch(false, PINCH_HOLD_MS * 0.95 + t)).toBeLessThan(1);
    }
  });

  it("確定したあとは、猶予の中で指が震えても二度目が走らない", () => {
    resetPinch();
    advancePinch(true, 0);
    expect(advancePinch(true, PINCH_HOLD_MS)).toBe(1);
    consumePinch();

    expect(advancePinch(false, PINCH_HOLD_MS + 50)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS + 100)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS * 3)).toBe(0);
  });

  it("確定したあと、しっかり離してからつまめば、次の行を選べる", () => {
    resetPinch();
    advancePinch(true, 0);
    advancePinch(true, PINCH_HOLD_MS);
    consumePinch();

    // 猶予は「離れて見えはじめてから」数えるので、そのあいだも毎フレーム届く
    const released = PINCH_HOLD_MS + 500;
    advancePinch(false, released);
    advancePinch(false, released + 300);

    expect(advancePinch(true, released + 310)).toBe(0);
    expect(advancePinch(true, released + 310 + PINCH_HOLD_MS)).toBe(1);
  });
});
