import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { composePythonProgram } from "./compose-python";
import { CJ_ERROR_MARKER, CJ_SUMMARY_MARKER } from "./markers";

// 担当: BE-B
// Python ハーネス（harness-python.ts）の自己テスト。
//
// TypeScript 版（harness.test.ts）は new Function でプレリュードを評価できるが、
// Python ではそれができないので、合成済みプログラムを実際の python に stdin から食わせる。
// stdin 実行（`python -`）なら sys.modules["__main__"] が正しく存在し、一時ファイルも要らない。
// 処理系が無い環境（CI など）では describe.skipIf でスキップし、テスト全体を落とさない。

/** python3 → python → py の順に実行可能なものを探す。 */
function findPython(): string | null {
  for (const candidate of ["python3", "python", "py"]) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf-8" });
    if (probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const python = findPython();

interface HarnessRun {
  exitCode: number;
  stdout: string;
}

function runPythonHarness(sourceCode: string, testCode: string): HarnessRun {
  const { program } = composePythonProgram({ sourceCode, testCode });
  try {
    const stdout = execFileSync(python as string, ["-"], {
      input: program,
      encoding: "utf-8",
      timeout: 15_000,
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    // 非ゼロ終了では execFileSync が throw する。status と stdout を取り出す。
    const failure = error as { status?: number | null; stdout?: string; message?: string };
    if (typeof failure.status !== "number") {
      throw new Error(`python の実行に失敗しました: ${failure.message ?? "原因不明"}`);
    }
    return { exitCode: failure.status, stdout: failure.stdout ?? "" };
  }
}

interface Summary {
  total: number;
  passed: number;
  failed: number;
  failures?: string[];
}

function summaryOf(stdout: string): Summary {
  const line = stdout
    .split("\n")
    .reverse()
    .find((candidate) => candidate.startsWith(CJ_SUMMARY_MARKER));
  if (!line) {
    throw new Error(`サマリ行が見つかりません: ${stdout}`);
  }
  return JSON.parse(line.slice(CJ_SUMMARY_MARKER.length)) as Summary;
}

const SOURCE = `def sum_all(numbers):
    total = 0
    for n in numbers:
        total += n
    return total`;

const PASSING_TEST = `import unittest


class TestSumAll(unittest.TestCase):
    def test_adds_numbers(self):
        self.assertEqual(sum_all([1, 2, 3]), 6)

    def test_empty_is_zero(self):
        self.assertEqual(sum_all([]), 0)`;

describe.skipIf(python === null)("Python ハーネス", () => {
  it("全テストが通ると exit 0 とサマリを返す", () => {
    const run = runPythonHarness(SOURCE, PASSING_TEST);
    expect(run.exitCode).toBe(0);
    expect(summaryOf(run.stdout)).toMatchObject({ total: 2, passed: 2, failed: 0 });
  });

  it("テストが失敗すると exit 1 と失敗内容を返す", () => {
    const brokenSource = `def sum_all(numbers):
    return 0`;
    const run = runPythonHarness(brokenSource, PASSING_TEST);
    expect(run.exitCode).toBe(1);
    const summary = summaryOf(run.stdout);
    expect(summary).toMatchObject({ total: 2, passed: 1, failed: 1 });
    expect(summary.failures?.[0]).toContain("test_adds_numbers");
  });

  it("対象コードが例外を投げると errors として失敗に数える", () => {
    const throwingSource = `def sum_all(numbers):
    raise ValueError("こわれています")`;
    const run = runPythonHarness(throwingSource, PASSING_TEST);
    expect(run.exitCode).toBe(1);
    expect(summaryOf(run.stdout).failed).toBe(2);
  });

  it("テストが1件も無いと失敗扱いにする", () => {
    const run = runPythonHarness(SOURCE, "import unittest");
    expect(run.exitCode).toBe(1);
    expect(summaryOf(run.stdout)).toMatchObject({ total: 0, failed: 1 });
  });

  it("プレイヤーの print はマーカー行を汚さない", () => {
    const noisySource = `print("この出力は捨てられる")


def sum_all(numbers):
    print("ここも捨てられる")
    return sum(numbers)`;
    const run = runPythonHarness(noisySource, PASSING_TEST);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).not.toContain("捨てられる");
    expect(summaryOf(run.stdout).passed).toBe(2);
  });

  it("__main__ ガードが除去され、エピローグで1回だけ実行される", () => {
    const testWithGuard = `${PASSING_TEST}


if __name__ == "__main__":
    unittest.main()`;
    const run = runPythonHarness(SOURCE, testWithGuard);
    expect(run.exitCode).toBe(0);
    const markers = run.stdout.split("\n").filter((line) => line.startsWith(CJ_SUMMARY_MARKER));
    expect(markers).toHaveLength(1);
  });

  it("対象コードを import しようとしても実行できる（相対 import が除去される）", () => {
    const testWithImport = `import unittest
from solution import sum_all


class TestSumAll(unittest.TestCase):
    def test_adds_numbers(self):
        self.assertEqual(sum_all([1, 2, 3]), 6)`;
    const run = runPythonHarness(SOURCE, testWithImport);
    expect(run.exitCode).toBe(0);
    expect(summaryOf(run.stdout)).toMatchObject({ total: 1, passed: 1, failed: 0 });
  });

  it("サマリが 800 バイトを超えると failures を落とす", () => {
    // 失敗が多いほど failures 配列が伸びる。メソッド名を長くして 800 バイトを確実に超えさせる。
    const methods = Array.from(
      { length: 12 },
      (_, index) => `    def test_${"very_long_failing_case_name".repeat(2)}_${index}(self):
        self.assertEqual(${index}, ${index + 1})`,
    ).join("\n\n");
    const failingTests = `import unittest


class TestLong(unittest.TestCase):
${methods}`;
    const run = runPythonHarness(SOURCE, failingTests);
    expect(run.exitCode).toBe(1);
    const summary = summaryOf(run.stdout);
    expect(summary).toMatchObject({ total: 12, passed: 0, failed: 12 });
    expect(summary.failures).toBeUndefined();
  });

  it("構文が壊れたテストコードはサマリ無しで落ちる（classify が error / failed に倒す）", () => {
    const run = runPythonHarness(SOURCE, "class Broken(unittest.TestCase:");
    expect(run.exitCode).not.toBe(0);
    expect(run.stdout).not.toContain(CJ_SUMMARY_MARKER);
  });

  it("ハーネス障害マーカーの形式が TypeScript 版と揃っている", () => {
    expect(CJ_ERROR_MARKER).toBe("__CJ_ERROR__");
    expect(CJ_SUMMARY_MARKER).toBe("__CJ_SUMMARY__");
  });
});
