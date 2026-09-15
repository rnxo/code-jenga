import { describe, expect, it } from "vitest";

import { composePythonProgram, sanitizePython, stripMainGuard, stripPythonImports } from "./compose-python";
import { CJ_PY_HARNESS_PRELUDE } from "./harness-python";

const SOURCE = `def sum_all(numbers):
    total = 0
    for n in numbers:
        total += n
    return total`;

describe("stripPythonImports", () => {
  it("対象コードの相対 import を空行に置換する", () => {
    const result = stripPythonImports('from solution import sum_all\nx = 1');
    expect(result.code).toBe("\nx = 1");
    expect(result.removed).toEqual(["from solution import sum_all"]);
  });

  it("import unittest と許可リストの標準ライブラリは残す", () => {
    const code = "import unittest\nfrom typing import List\nimport math\n";
    expect(stripPythonImports(code).code).toBe(code);
  });

  it("許可リスト外の import は除去する", () => {
    const result = stripPythonImports("import requests\nimport numpy as np");
    expect(result.code).toBe("\n");
    expect(result.removed).toHaveLength(2);
  });

  it("sys は許可しない（ハーネスの stdout / exit を壊されないため）", () => {
    expect(stripPythonImports("import sys").code).toBe("");
  });

  it("from __future__ import は常に除去する（先頭以外だと構文エラーになる）", () => {
    expect(stripPythonImports("from __future__ import annotations").code).toBe("");
  });

  it("許可モジュールと未許可モジュールの混在行は行ごと除去する", () => {
    const result = stripPythonImports("import math, solution");
    expect(result.code).toBe("");
    expect(result.removed).toEqual(["import math, solution"]);
  });

  it("インデント付きの import には触らない（IndentationError を避けるため）", () => {
    const code = "if True:\n    from solution import sum_all";
    expect(stripPythonImports(code).code).toBe(code);
  });

  it("括弧で続く import ブロックをまとめて空行にする", () => {
    const code = "from solution import (\n    sum_all,\n    average,\n)\nx = 1";
    const result = stripPythonImports(code);
    expect(result.code).toBe("\n\n\n\nx = 1");
    expect(result.removed).toHaveLength(4);
  });

  it("行数を保つ", () => {
    const code = "from solution import sum_all\nimport requests\nx = 1\n";
    expect(stripPythonImports(code).code.split("\n")).toHaveLength(code.split("\n").length);
  });
});

describe("stripMainGuard", () => {
  it("__main__ ガードとその配下を空行にする", () => {
    const code = 'x = 1\nif __name__ == "__main__":\n    unittest.main()\n';
    const result = stripMainGuard(code);
    expect(result.code).toBe("x = 1\n\n\n");
    expect(result.removed).toHaveLength(3);
  });

  it("列0の unittest.main() 単独行も除去する", () => {
    expect(stripMainGuard("unittest.main()").code).toBe("");
  });

  it("ガードの後ろに続く列0の行は残す", () => {
    const code = 'if __name__ == "__main__":\n    unittest.main()\nz = 3';
    expect(stripMainGuard(code).code).toBe("\n\nz = 3");
  });
});

describe("sanitizePython", () => {
  it("Markdown のコードフェンスを取り除く", () => {
    expect(sanitizePython("```python\nx = 1\n```").code.trim()).toBe("x = 1");
  });
});

describe("composePythonProgram", () => {
  it("プレリュード → 対象 → テスト → エピローグの順に並べる", () => {
    const { program } = composePythonProgram({ sourceCode: SOURCE, testCode: "import unittest" });
    expect(program.indexOf("harness prelude")).toBeLessThan(program.indexOf("# ---- source ----"));
    expect(program.indexOf("# ---- source ----")).toBeLessThan(program.indexOf("# ---- test ----"));
    expect(program.indexOf("# ---- test ----")).toBeLessThan(program.indexOf("harness epilogue"));
  });

  it("sourceStartLine がプレリュードの行数と一致する", () => {
    const { program, sourceStartLine } = composePythonProgram({ sourceCode: SOURCE, testCode: "" });
    const head = `${CJ_PY_HARNESS_PRELUDE}\n# ---- source ----\n`;
    expect(sourceStartLine).toBe(head.split("\n").length);
    expect(program.split("\n")[sourceStartLine - 1]).toBe(SOURCE.split("\n")[0]);
  });

  it("対象コードとテストコードが列0のまま合成される", () => {
    const { program } = composePythonProgram({ sourceCode: SOURCE, testCode: "class T(unittest.TestCase):\n    pass" });
    expect(program).toContain("\ndef sum_all(numbers):");
    expect(program).toContain("\nclass T(unittest.TestCase):");
  });
});
