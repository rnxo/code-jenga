import { describe, expect, it } from "vitest";
import { runBrainfuck } from "./brainfuck-interpreter";

describe("runBrainfuck", () => {
  it("ループで作った値を出力できる", () => {
    const result = runBrainfuck("++++++++\n[>+++++++++<-]\n>.");
    expect(result).toEqual({ ok: true, output: "H", steps: expect.any(Number) });
  });

  it("8命令以外の文字はコメントとして無視する", () => {
    expect(runBrainfuck("plus: +++++ wait\n+++++ ok\nprint .")).toMatchObject({ ok: true, output: "\n" });
  });

  it("括弧の対応が取れていなければエラー", () => {
    expect(runBrainfuck("+[>+")).toEqual({ ok: false, reason: "[ と ] の対応が取れていません。" });
    expect(runBrainfuck("+]")).toEqual({ ok: false, reason: "[ と ] の対応が取れていません。" });
  });

  it("無限ループはステップ上限で止める", () => {
    const result = runBrainfuck("+[]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("上限");
    }
  });

  it("テープの左端を超えるとエラー", () => {
    expect(runBrainfuck("<")).toEqual({ ok: false, reason: "ポインタがテープの左端を超えました。" });
  });

  it("入力命令は 0 を書く", () => {
    expect(runBrainfuck("+++,.")).toMatchObject({ ok: true, output: String.fromCharCode(0) });
  });
});
