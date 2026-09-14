import { describe, expect, it } from "vitest";
import { countLines, deleteLine, isBlankLine, isDeletableLine } from "./code";

describe("countLines", () => {
  it("空文字列は0行として扱う", () => {
    expect(countLines("")).toBe(0);
  });

  it("改行区切りで行数を数える", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

describe("isDeletableLine", () => {
  it("範囲内の行番号は削除可能と判定する", () => {
    expect(isDeletableLine("a\nb\nc", 2)).toBe(true);
  });

  it("範囲外の行番号は削除不可と判定する", () => {
    expect(isDeletableLine("a\nb\nc", 4)).toBe(false);
    expect(isDeletableLine("a\nb\nc", 0)).toBe(false);
  });
});

describe("deleteLine", () => {
  it("指定行を削除したコードと削除内容を返す", () => {
    const result = deleteLine("a\nb\nc", 2);
    expect(result.codeAfter).toBe("a\nc");
    expect(result.deletedLineText).toBe("b");
  });

  it("範囲外の行番号は例外を投げる", () => {
    expect(() => deleteLine("a\nb\nc", 10)).toThrow();
  });
});

describe("isBlankLine", () => {
  it("空白のみの行は true", () => {
    expect(isBlankLine("   ")).toBe(true);
  });

  it("内容がある行は false", () => {
    expect(isBlankLine("  const x = 1;")).toBe(false);
  });
});
