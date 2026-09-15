import { beforeEach, describe, expect, it } from "vitest";
import {
  advancePinch,
  consumePinch,
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

  it("指を一度離せば、次のつまみは数え直せる", () => {
    advancePinch(true, 0);
    advancePinch(true, PINCH_HOLD_MS);
    consumePinch();

    expect(advancePinch(false, PINCH_HOLD_MS + 10)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS + 20)).toBe(0);
    expect(advancePinch(true, PINCH_HOLD_MS * 2 + 20)).toBe(1);
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
