import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { judgeTurnResult } from "./judge";

describe("judgeTurnResult", () => {
  it("passed は safe と判定する", () => {
    expect(judgeTurnResult("passed")).toEqual({ judged: true, result: "safe" });
  });

  it("failed は out と判定する", () => {
    expect(judgeTurnResult("failed")).toEqual({ judged: true, result: "out" });
  });

  it("error（Piston 呼び出し自体の失敗）は out にせず判定不能を返す", () => {
    const judgement = judgeTurnResult("error");
    expect(judgement.judged).toBe(false);
    if (!judgement.judged) {
      expect(judgement.reason).toMatch(/確定できません/);
    }
  });
});
