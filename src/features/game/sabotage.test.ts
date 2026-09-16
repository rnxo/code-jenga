import { describe, expect, it } from "vitest";
import {
  INITIAL_COOLDOWN,
  SPIN_DURATION_MS,
  SPIN_OVERSHOOT_DEG,
  canSendSabotage,
  isSabotagePayload,
  markSabotageSent,
  sabotageChannelName,
  spinAngleAt,
} from "./sabotage";

// 妨害（タワー回し）の計算部分の見張り。演出そのものは目で見るしかないが、
// 「回したあと元の角度に戻る」「相手からの変な payload を弾く」はここで固める。

describe("isSabotagePayload", () => {
  it("正しい形なら通す", () => {
    expect(isSabotagePayload({ senderId: "u1", seed: 0.3 })).toBe(true);
    expect(isSabotagePayload({ senderId: "u1", seed: 0 })).toBe(true);
    expect(isSabotagePayload({ senderId: "u1", seed: 1 })).toBe(true);
  });

  it("形が違えば弾く", () => {
    expect(isSabotagePayload(null)).toBe(false);
    expect(isSabotagePayload("spin")).toBe(false);
    expect(isSabotagePayload({})).toBe(false);
    expect(isSabotagePayload({ senderId: "", seed: 0.5 })).toBe(false);
    expect(isSabotagePayload({ senderId: "u1", seed: "0.5" })).toBe(false);
    expect(isSabotagePayload({ senderId: "u1", seed: 2 })).toBe(false);
    expect(isSabotagePayload({ senderId: "u1", seed: Number.NaN })).toBe(false);
  });
});

describe("spinAngleAt", () => {
  it("始まりと終わりは 0 度（ユーザーの角度と食い違わない）", () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 1]) {
      expect(spinAngleAt(0, seed)).toBe(0);
      expect(spinAngleAt(-10, seed)).toBe(0);
      expect(spinAngleAt(SPIN_DURATION_MS, seed)).toBe(0);
      expect(spinAngleAt(SPIN_DURATION_MS + 1000, seed)).toBe(0);
    }
  });

  it("途中で一回転ぶん（360 度以上）回る", () => {
    for (const seed of [0.1, 0.9]) {
      let max = 0;
      for (let t = 0; t < SPIN_DURATION_MS; t += 10) {
        max = Math.max(max, Math.abs(spinAngleAt(t, seed)));
      }
      expect(max).toBeGreaterThanOrEqual(360);
      expect(max).toBeLessThanOrEqual(360 + SPIN_OVERSHOOT_DEG);
    }
  });

  it("終わる直前は 360 度ちょうどに落ち着く（mod で 0 に畳める）", () => {
    const nearEnd = spinAngleAt(SPIN_DURATION_MS - 1, 0.8);
    expect(Math.abs(Math.abs(nearEnd) - 360)).toBeLessThan(0.5);
  });

  it("seed で回る向きが変わる", () => {
    const mid = SPIN_DURATION_MS / 2;
    expect(spinAngleAt(mid, 0.2)).toBeLessThan(0);
    expect(spinAngleAt(mid, 0.8)).toBeGreaterThan(0);
  });

  it("前半は単調に回り続ける（途中で戻らない）", () => {
    let prev = 0;
    for (let t = 0; t <= SPIN_DURATION_MS * 0.7; t += 10) {
      const current = spinAngleAt(t, 1);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });
});

describe("クールダウン（1ターン1回）", () => {
  it("最初は送れる", () => {
    expect(canSendSabotage(INITIAL_COOLDOWN, 3)).toBe(true);
  });

  it("送ったターンでは送れず、次のターンで戻る", () => {
    const sent = markSabotageSent(3);
    expect(canSendSabotage(sent, 3)).toBe(false);
    expect(canSendSabotage(sent, 4)).toBe(true);
  });
});

describe("sabotageChannelName", () => {
  it("試合ごとに別名で、盤面の購読（game:${id}）とも被らない", () => {
    expect(sabotageChannelName("abc")).toBe("game:abc:sabotage");
    expect(sabotageChannelName("abc")).not.toBe("game:abc");
  });
});
