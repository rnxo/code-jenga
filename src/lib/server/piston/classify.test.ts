import { describe, expect, it } from "vitest";
import { classifyPistonRun, isPistonExecuteResponse, type PistonExecuteResponse, type PistonStage } from "./classify";

function stage(overrides: Partial<PistonStage>): PistonStage {
  return { stdout: "", stderr: "", output: "", code: 0, signal: null, ...overrides };
}

function response(run: Partial<PistonStage>, compile?: Partial<PistonStage>): PistonExecuteResponse {
  return { language: "deno", version: "1.32.3", run: stage(run), ...(compile ? { compile: stage(compile) } : {}) };
}

describe("isPistonExecuteResponse", () => {
  it("run ステージを持つオブジェクトだけを受け入れる", () => {
    expect(isPistonExecuteResponse(response({}))).toBe(true);
    expect(isPistonExecuteResponse({ language: "deno", version: "1" })).toBe(false);
    expect(isPistonExecuteResponse({ language: "deno", version: "1", run: { stdout: 1 } })).toBe(false);
    expect(isPistonExecuteResponse(null)).toBe(false);
  });
});

describe("classifyPistonRun", () => {
  it("exit 0 + サマリあり → passed", () => {
    const c = classifyPistonRun(response({ code: 0, stdout: '__CJ_SUMMARY__{"total":1,"passed":1,"failed":0}\n' }));
    expect(c).toMatchObject({ outcome: "passed", exitCode: 0 });
  });

  it("exit 非ゼロ → failed（終了コードを保持）", () => {
    expect(classifyPistonRun(response({ code: 1 }))).toMatchObject({ outcome: "failed", exitCode: 1 });
  });

  it("exit 0 だがサマリ無し / ハーネス障害 → error（exitCode null）", () => {
    expect(classifyPistonRun(response({ code: 0, stdout: "" }))).toMatchObject({ outcome: "error", exitCode: null });
    const c = classifyPistonRun(response({ code: 0, stdout: '__CJ_ERROR__{"message":"未対応のマッチャーです: toBeOneOf"}' }));
    expect(c.outcome).toBe("error");
    expect(c.errorMessage).toContain("toBeOneOf");
  });

  it("タイムアウト（status TO / SIGKILL）→ failed 124", () => {
    expect(classifyPistonRun(response({ code: null, signal: "SIGKILL", status: "TO" }))).toMatchObject({ outcome: "failed", exitCode: 124 });
    expect(classifyPistonRun(response({ code: null, signal: "SIGKILL" }))).toMatchObject({ outcome: "failed", exitCode: 124 });
  });

  it("出力超過（OL / EL）→ failed 137", () => {
    expect(classifyPistonRun(response({ code: null, signal: "SIGKILL", status: "OL" }))).toMatchObject({ exitCode: 137 });
    expect(classifyPistonRun(response({ code: null, signal: "SIGKILL", status: "EL" }))).toMatchObject({ exitCode: 137 });
  });

  it("code も signal も無い → error", () => {
    expect(classifyPistonRun(response({ code: null, signal: null }))).toMatchObject({ outcome: "error", exitCode: null });
  });

  it("compile 失敗 → failed（compile の終了コード）", () => {
    expect(classifyPistonRun(response({ code: 0 }, { code: 2, stderr: "TS2304" }))).toMatchObject({ outcome: "failed", exitCode: 2 });
  });
});
