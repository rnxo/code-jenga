import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/piston/run", () => ({ runOnPiston: vi.fn() }));

import { PistonError } from "@/lib/server/piston/errors";
import { runOnPiston, type PistonRunInput, type PistonRunResult } from "@/lib/server/piston/run";
import { computeSafeLines } from "./safe-lines";

const PASSED_STDOUT = "      Tests  2 passed (2)\n";
const FAILED_STDOUT = "      Tests  1 failed | 1 passed (2)\n";

function pistonResult(overrides: Partial<PistonRunResult> = {}): PistonRunResult {
  return {
    outcome: "passed",
    exitCode: 0,
    stdout: PASSED_STDOUT,
    stderr: "",
    compileOutput: null,
    raw: {},
    executedCode: "",
    resolvedLanguage: "deno",
    resolvedVersion: "1.32.3",
    errorMessage: null,
    ...overrides,
  };
}

// 1行目: 未使用の定数（セーフ）、2行目: 空行、3行目: 重要な関数宣言（クリティカル）、4行目: コメント（セーフ）
const SOURCE = ["const UNUSED = 1;", "", "export const answer = () => 42;", "// note"].join("\n");
const TEST = 'it("answer", () => { expect(answer()).toBe(42); });';

beforeEach(() => {
  vi.mocked(runOnPiston).mockReset();
});

describe("computeSafeLines", () => {
  it("削除してもテストが通る行だけをセーフ行として返し、空行は Piston を叩かずにセーフ扱いにする", async () => {
    vi.mocked(runOnPiston).mockImplementation(async (input: PistonRunInput) => {
      // 重要な行を消したコードだけテストが落ちる。
      const broken = !input.sourceCode?.includes("answer = () => 42");
      return pistonResult(
        broken ? { outcome: "failed", exitCode: 1, stdout: FAILED_STDOUT } : { stdout: PASSED_STDOUT },
      );
    });

    const result = await computeSafeLines({ sourceCode: SOURCE, testCode: TEST, language: "typescript" });

    expect(result.safeLineTexts).toEqual(["const UNUSED = 1;", "", "// note"]);
    expect(result.nonBlankSafeLineCount).toBe(2);
    expect(result.pistonRuns).toBe(3);
    expect(runOnPiston).toHaveBeenCalledTimes(3);
  });

  it("outcome が error（判定不能）の行はセーフ扱いにしない", async () => {
    vi.mocked(runOnPiston).mockResolvedValue(
      pistonResult({ outcome: "error", exitCode: null, stdout: "", errorMessage: "harness crashed" }),
    );

    const result = await computeSafeLines({ sourceCode: SOURCE, testCode: TEST, language: "typescript" });

    expect(result.safeLineTexts).toEqual([""]);
    expect(result.nonBlankSafeLineCount).toBe(0);
  });

  it("テストが0件の出力はセーフ扱いにしない", async () => {
    vi.mocked(runOnPiston).mockResolvedValue(pistonResult({ stdout: "      Tests  0 passed (0)\n" }));

    const result = await computeSafeLines({ sourceCode: SOURCE, testCode: TEST, language: "typescript" });

    expect(result.nonBlankSafeLineCount).toBe(0);
  });

  it("同じテキストの行は重複せずに1つだけ保存する", async () => {
    vi.mocked(runOnPiston).mockResolvedValue(pistonResult());
    const source = ["x = 1", "x = 1", "y = 2"].join("\n");

    const result = await computeSafeLines({ sourceCode: source, testCode: TEST, language: "python" });

    expect(result.safeLineTexts).toEqual(["x = 1", "y = 2"]);
    expect(result.nonBlankSafeLineCount).toBe(3);
  });

  it("Piston 呼び出し自体の失敗は握りつぶさずに伝播する", async () => {
    vi.mocked(runOnPiston).mockRejectedValue(new PistonError("network", "Piston に接続できません"));

    await expect(
      computeSafeLines({ sourceCode: SOURCE, testCode: TEST, language: "typescript" }),
    ).rejects.toBeInstanceOf(PistonError);
  });

  it("空のコードは Piston を叩かずに空の結果を返す", async () => {
    const result = await computeSafeLines({ sourceCode: "", testCode: TEST, language: "typescript" });

    expect(result).toEqual({ safeLineTexts: [], nonBlankSafeLineCount: 0, pistonRuns: 0 });
    expect(runOnPiston).not.toHaveBeenCalled();
  });
});
