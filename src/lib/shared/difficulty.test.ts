import { describe, expect, it } from "vitest";
import {
  classifyLine,
  hasDeletableLine,
  isDeletableUnder,
  listDeletableLineNumbers,
  rollTurnDifficulty,
} from "./difficulty";

const SAMPLE_SOURCE = [
  "function sum(numbers: number[]): number {",
  "  let total = 0;",
  "  for (const n of numbers) {",
  "    total += n;",
  "  }",
  "  return total;",
  "}",
].join("\n");

describe("classifyLine", () => {
  it("空行は blank", () => {
    expect(classifyLine("   ")).toBe("blank");
  });

  it("行コメントは comment", () => {
    expect(classifyLine("  // 合計を返す")).toBe("comment");
  });

  it("ブロックコメントの開始行は comment", () => {
    expect(classifyLine("/* 説明")).toBe("comment");
  });

  it("JSDoc の継続行（* から始まる行）は comment", () => {
    expect(classifyLine(" * @param numbers")).toBe("comment");
  });

  it("記号だけの行は symbol-only", () => {
    expect(classifyLine("}")).toBe("symbol-only");
    expect(classifyLine("  });")).toBe("symbol-only");
    expect(classifyLine("];")).toBe("symbol-only");
  });

  it("宣言・制御キーワードを含む行は declaration", () => {
    expect(classifyLine("function sum(numbers: number[]): number {")).toBe("declaration");
    expect(classifyLine("  let total = 0;")).toBe("declaration");
    expect(classifyLine("  if (total > 0) {")).toBe("declaration");
  });

  it("それ以外の実コード行は expression", () => {
    expect(classifyLine("    total += n;")).toBe("expression");
  });

  it("文字列リテラル内の // では comment 誤判定しない", () => {
    expect(classifyLine('  const url = "https://example.com";')).toBe("declaration");
  });
});

describe("isDeletableUnder", () => {
  it("EASY はどの種別の行でも削除できる", () => {
    expect(isDeletableUnder("easy", "}")).toBe(true);
    expect(isDeletableUnder("easy", "// comment")).toBe(true);
    expect(isDeletableUnder("easy", "")).toBe(true);
  });

  it("NORMAL は空行・コメント・記号だけの行を削除できない", () => {
    expect(isDeletableUnder("normal", "")).toBe(false);
    expect(isDeletableUnder("normal", "// comment")).toBe(false);
    expect(isDeletableUnder("normal", "}")).toBe(false);
    expect(isDeletableUnder("normal", "total += n;")).toBe(true);
    expect(isDeletableUnder("normal", "let total = 0;")).toBe(true);
  });

  it("HARD は宣言・制御行しか削除できない", () => {
    expect(isDeletableUnder("hard", "total += n;")).toBe(false);
    expect(isDeletableUnder("hard", "let total = 0;")).toBe(true);
  });
});

describe("listDeletableLineNumbers（単調性: HARD ⊆ NORMAL ⊆ EASY）", () => {
  it("空文字列のコードは常に0行", () => {
    expect(listDeletableLineNumbers("", "easy")).toEqual([]);
  });

  it("サンプルコードで難易度ごとの削除可能行を正しく列挙する", () => {
    expect(listDeletableLineNumbers(SAMPLE_SOURCE, "easy")).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(listDeletableLineNumbers(SAMPLE_SOURCE, "normal")).toEqual([1, 2, 3, 4, 6]);
    expect(listDeletableLineNumbers(SAMPLE_SOURCE, "hard")).toEqual([1, 2, 3, 6]);
  });

  it("HARD の削除可能行は NORMAL の部分集合、NORMAL は EASY の部分集合", () => {
    const easyLines = new Set(listDeletableLineNumbers(SAMPLE_SOURCE, "easy"));
    const normalLines = listDeletableLineNumbers(SAMPLE_SOURCE, "normal");
    const hardLines = listDeletableLineNumbers(SAMPLE_SOURCE, "hard");

    for (const lineNo of normalLines) {
      expect(easyLines.has(lineNo)).toBe(true);
    }
    const normalLineSet = new Set(normalLines);
    for (const lineNo of hardLines) {
      expect(normalLineSet.has(lineNo)).toBe(true);
    }
  });
});

describe("hasDeletableLine", () => {
  it("宣言行が無いコードは HARD で削除可能行が0行", () => {
    const code = ["// comment", "}", "];"].join("\n");
    expect(hasDeletableLine(code, "hard")).toBe(false);
    expect(hasDeletableLine(code, "normal")).toBe(false);
    expect(hasDeletableLine(code, "easy")).toBe(true);
  });
});

describe("rollTurnDifficulty", () => {
  it("random の戻り値に応じて EASY/NORMAL/HARD を均等に抽選する", () => {
    expect(rollTurnDifficulty(SAMPLE_SOURCE, () => 0)).toBe("easy");
    expect(rollTurnDifficulty(SAMPLE_SOURCE, () => 0.4)).toBe("normal");
    expect(rollTurnDifficulty(SAMPLE_SOURCE, () => 0.9)).toBe("hard");
  });

  it("random が1に近い境界値でも例外を投げない", () => {
    expect(rollTurnDifficulty(SAMPLE_SOURCE, () => 0.999999)).toBe("hard");
  });

  it("抽選結果で削除できる行が無い場合は EASY にフォールバックする", () => {
    const code = ["// comment", "}", "];"].join("\n");
    expect(rollTurnDifficulty(code, () => 0.9)).toBe("easy");
    expect(rollTurnDifficulty(code, () => 0.4)).toBe("easy");
  });
});
