import * as nodeModule from "node:module";
import { describe, expect, it, vi } from "vitest";
import { composeProgram } from "./compose";
import { CJ_ERROR_MARKER, CJ_HARNESS_EPILOGUE, CJ_SUMMARY_MARKER } from "./harness";

// Node 22.13+ / 24 に存在するが @types/node v20 には型が無いため、unknown 経由で取り出す。
const { stripTypeScriptTypes } = nodeModule as unknown as {
  stripTypeScriptTypes: (code: string, options: { mode: "strip" }) => string;
};

// ハーネスは型注釈のない純 JS として書かれているため、Piston を叩かずに new Function で評価して検証できる。
// __cjOnExit を注入して process.exit / Deno.exit の代わりに終了コードを受け取る。

interface HarnessRun {
  exitCode: number | null;
  lines: string[];
}

async function runHarness(sourceCode: string, testCode: string): Promise<HarnessRun> {
  const { program } = composeProgram({ sourceCode, testCode });
  // エピローグの __cjRun() を return 付きに差し替えて完了を待てるようにし、
  // Node 24 の型ストリップで TypeScript の型注釈を落としてから new Function で評価する。
  const script = stripTypeScriptTypes(program, { mode: "strip" }).replace(CJ_HARNESS_EPILOGUE, "\nreturn __cjRun();\n");
  const lines: string[] = [];
  let exitCode: number | null = null;
  const originalLog = console.log;
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  try {
    const run = new Function("__cjOnExit", script) as (onExit: (code: number) => void) => Promise<void>;
    await run((code) => {
      exitCode = code;
    });
  } finally {
    logSpy.mockRestore();
    console.log = originalLog;
  }
  return { exitCode, lines };
}

function summaryOf(run: HarnessRun): { total: number; passed: number; failed: number; failures?: string[] } {
  const line = run.lines.find((l) => l.startsWith(CJ_SUMMARY_MARKER));
  if (!line) throw new Error(`サマリ行がありません: ${JSON.stringify(run.lines)}`);
  return JSON.parse(line.slice(CJ_SUMMARY_MARKER.length)) as { total: number; passed: number; failed: number; failures?: string[] };
}

const SOURCE = [
  "export function sum(numbers: number[]): number {",
  "  let total = 0;",
  "  for (const n of numbers) {",
  "    total += n;",
  "  }",
  "  return total;",
  "}",
].join("\n");

describe("harness", () => {
  it("全テスト通過で exit 0 とサマリを出す", async () => {
    const run = await runHarness(
      SOURCE,
      `import { describe, expect, it } from "vitest";
import { sum } from "./sum";
describe("sum", () => {
  it("合計を返す", () => { expect(sum([1, 2, 3])).toBe(6); });
  it("空配列は 0", () => { expect(sum([])).toBe(0); });
});`,
    );
    expect(run.exitCode).toBe(0);
    expect(summaryOf(run)).toEqual({ total: 2, passed: 2, failed: 0, failures: [] });
  });

  it("失敗があれば exit 1 と失敗名を出す", async () => {
    const run = await runHarness(
      SOURCE.replace("    total += n;\n", ""),
      `import { expect, it } from "vitest";
it("合計を返す", () => { expect(sum([1, 2, 3])).toBe(6); });`,
    );
    expect(run.exitCode).toBe(1);
    const summary = summaryOf(run);
    expect(summary.failed).toBe(1);
    expect(summary.failures?.[0]).toContain("合計を返す");
  });

  it("toEqual は深い比較、.not は反転する", async () => {
    const run = await runHarness(
      "const make = () => ({ a: [1, { b: 2 }], m: new Map([[1, 2]]) });",
      `it("deep", () => {
  expect(make()).toEqual({ a: [1, { b: 2 }], m: new Map([[1, 2]]) });
  expect(make()).not.toEqual({ a: [1, { b: 3 }] });
  expect(() => { throw new Error("boom"); }).toThrow("boom");
  expect([1, 2]).toContain(2);
  expect("abc").toMatch(/b/);
  expect(0.1 + 0.2).toBeCloseTo(0.3);
});`,
    );
    expect(run.exitCode).toBe(0);
    expect(summaryOf(run).passed).toBe(1);
  });

  it("未対応マッチャーはハーネス障害として exit 0 + エラーマーカーになる", async () => {
    const run = await runHarness("const x = 1;", `it("a", () => { expect(x).toBeOneOf([1]); });`);
    expect(run.exitCode).toBe(0);
    expect(run.lines.some((l) => l.startsWith(CJ_ERROR_MARKER) && l.includes("toBeOneOf"))).toBe(true);
    expect(run.lines.some((l) => l.startsWith(CJ_SUMMARY_MARKER))).toBe(false);
  });

  it("テストが0件なら失敗扱いにする", async () => {
    const run = await runHarness("const x = 1;", "");
    expect(run.exitCode).toBe(1);
    expect(summaryOf(run).failed).toBe(1);
  });

  it("ユーザーの console.log は出力されない（出力サイズ上限対策）", async () => {
    const run = await runHarness("console.log('noise'.repeat(100));", `it("a", () => { console.log("x"); expect(1).toBe(1); });`);
    expect(run.lines).toHaveLength(1);
    expect(run.lines[0].startsWith(CJ_SUMMARY_MARKER)).toBe(true);
  });

  it("サマリが 800 バイトを超えたら failures を落とす", async () => {
    const tests = Array.from({ length: 30 }, (_, i) => `it("test number ${i} with a long name", () => { expect(1).toBe(2); });`).join("\n");
    const run = await runHarness("", tests);
    const line = run.lines.find((l) => l.startsWith(CJ_SUMMARY_MARKER)) ?? "";
    expect(line.length).toBeLessThanOrEqual(800);
    expect(summaryOf(run)).toEqual({ total: 30, passed: 0, failed: 30 });
  });
});
