import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceDwell,
  consumeDwell,
  DWELL_MS,
  resetDwell,
  toScreenRatio,
} from "./hand-tracking";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// カメラを繋がないと確かめられない部分なので、座標の計算だけここで固めておく。

function point(x: number, y: number): NormalizedLandmark {
  return { x, y, z: 0, visibility: 1 };
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


describe("advanceDwell", () => {
  // モジュールに状態を持つので、毎回まっさらから始める
  beforeEach(() => {
    resetDwell();
  });

  /** 同じ場所に指を置き続ける。fps ごとに1回呼び、最後は seconds ちょうどで呼ぶ */
  function stayStill(key: string, seconds: number, fps = 30): number {
    let progress = 0;
    const frames = Math.round(seconds * fps);
    for (let frame = 0; frame <= frames; frame += 1) {
      progress = advanceDwell(key, 500, 400, Math.min(frame / fps, seconds) * 1000);
    }
    return progress;
  }

  it("指を止め続けると、時間に応じて 1 まで満ちる", () => {
    expect(advanceDwell("3", 500, 400, 0)).toBe(0);
    expect(advanceDwell("3", 500, 400, DWELL_MS / 2)).toBeCloseTo(0.5, 5);
    expect(advanceDwell("3", 500, 400, DWELL_MS)).toBe(1);
  });

  it("満ちても 1 を超えない", () => {
    advanceDwell("3", 500, 400, 0);
    expect(advanceDwell("3", 500, 400, DWELL_MS * 10)).toBe(1);
  });

  it("指が動いたら数え直す（止まっていないと決まらない）", () => {
    advanceDwell("3", 500, 400, 0);
    expect(advanceDwell("3", 500, 400, DWELL_MS * 0.9)).toBeCloseTo(0.9, 5);

    // 大きく動かす
    expect(advanceDwell("3", 560, 400, DWELL_MS * 0.9 + 10)).toBe(0);
    // 動いた先から数え直しなので、すぐには満ちない
    expect(advanceDwell("3", 560, 400, DWELL_MS * 0.9 + 20)).toBeLessThan(0.1);
  });

  it("手の細かい震えくらいでは数え直さない", () => {
    advanceDwell("3", 500, 400, 0);
    // 数 px のぶれは「止まっている」に入れる
    expect(advanceDwell("3", 508, 405, DWELL_MS * 0.5)).toBeCloseTo(0.5, 5);
    expect(advanceDwell("3", 495, 396, DWELL_MS)).toBe(1);
  });

  it("別の行へ移ったら数え直す", () => {
    advanceDwell("3", 500, 400, 0);
    expect(advanceDwell("3", 500, 400, DWELL_MS * 0.9)).toBeCloseTo(0.9, 5);
    // 座標はほぼ同じでも、指している木片が変わったら 0 から
    expect(advanceDwell("4", 500, 402, DWELL_MS * 0.9 + 10)).toBe(0);
  });

  it("確定したら、その場を離れるまで二度目が走らない", () => {
    expect(stayStill("3", DWELL_MS / 1000)).toBe(1);
    consumeDwell();

    // 置きっぱなしでも、もう満ちない
    expect(stayStill("3", 3)).toBe(0);
  });

  it("確定したあと、指を動かせば次の行を選べる", () => {
    stayStill("3", DWELL_MS / 1000);
    consumeDwell();

    // 別の行へ移る
    expect(advanceDwell("4", 500, 500, 10_000)).toBe(0);
    expect(advanceDwell("4", 500, 500, 10_000 + DWELL_MS)).toBe(1);
  });

  it("木片から外れたら、猶予を過ぎた時点で数えたぶんが消える", () => {
    advanceDwell("3", 500, 400, 0);
    expect(advanceDwell("3", 500, 400, DWELL_MS * 0.6)).toBeCloseTo(0.6, 5);

    // 外れて見えた瞬間の値で止まる（そこから進まない）
    expect(advanceDwell(null, 0, 0, DWELL_MS * 0.6)).toBeCloseTo(0.6, 5);
    expect(advanceDwell(null, 0, 0, DWELL_MS * 0.6 + 100)).toBeCloseTo(0.6, 5);
    // 猶予を過ぎたら消える
    expect(advanceDwell(null, 0, 0, DWELL_MS * 0.6 + 400)).toBe(0);
  });

  it("猶予だけで満ちることはない（指を外したのに削除されない）", () => {
    advanceDwell("3", 500, 400, 0);
    advanceDwell("3", 500, 400, DWELL_MS * 0.95);
    for (const t of [10, 50, 100, 150, 210]) {
      expect(advanceDwell(null, 0, 0, DWELL_MS * 0.95 + t)).toBeLessThan(1);
    }
  });

  it("検出が2割すべっても、指を止めていれば決まる", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      resetDwell();
      let random = seed;
      const next = () => {
        random = (random * 1664525 + 1013904223) % 4294967296;
        return random / 4294967296;
      };
      let done = false;
      for (let frame = 0; frame < 30 * 3 && !done; frame += 1) {
        const now = (frame / 30) * 1000;
        const detected = next() >= 0.2;
        const progress = detected
          ? advanceDwell("3", 500, 400, now)
          : advanceDwell(null, 0, 0, now);
        if (progress >= 1) {
          done = true;
        }
      }
      expect(done, `seed ${seed}`).toBe(true);
    }
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
