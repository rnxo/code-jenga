import { describe, expect, it } from "vitest";
import { parseVitestOutput } from "./parse-vitest";

describe("parseVitestOutput", () => {
  it("マーカー行をパースする", () => {
    expect(parseVitestOutput('__CJ_SUMMARY__{"total":3,"passed":2,"failed":1,"failures":["a"]}\n')).toEqual({
      totalTests: 3,
      passedTests: 2,
      failedTests: 1,
    });
  });

  it("マーカーが複数あれば末尾を優先する", () => {
    const stdout = '__CJ_SUMMARY__{"total":1,"passed":0,"failed":1}\nnoise\n__CJ_SUMMARY__{"total":2,"passed":2,"failed":0}';
    expect(parseVitestOutput(stdout)?.passedTests).toBe(2);
  });

  it("マーカーが無ければ null", () => {
    expect(parseVitestOutput("hello\n")).toBeNull();
    expect(parseVitestOutput("")).toBeNull();
  });

  it("JSON が壊れていても throw せず null", () => {
    expect(parseVitestOutput("__CJ_SUMMARY__{oops")).toBeNull();
    expect(parseVitestOutput('__CJ_SUMMARY__{"total":"3"}')).toBeNull();
    expect(parseVitestOutput('__CJ_SUMMARY__{"total":-1,"passed":0,"failed":0}')).toBeNull();
  });

  it("本物の Vitest テキスト形式もパースする", () => {
    expect(parseVitestOutput(" Test Files  1 passed (1)\n      Tests  1 failed | 2 passed (3)\n")).toEqual({
      totalTests: 3,
      passedTests: 2,
      failedTests: 1,
    });
    expect(parseVitestOutput("      Tests  2 passed (2)")).toEqual({ totalTests: 2, passedTests: 2, failedTests: 0 });
  });
});
