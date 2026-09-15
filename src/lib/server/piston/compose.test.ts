import { describe, expect, it } from "vitest";
import { composeProgram, stripCodeFence, stripExports, stripImports } from "./compose";
import { composeBrainfuckProgram } from "./compose-brainfuck";
import { CJ_HARNESS_EPILOGUE, CJ_HARNESS_PRELUDE } from "./harness";

describe("stripImports", () => {
  it("単一行 import を空行に置換して行数を保つ", () => {
    const input = 'import { describe, expect, it } from "vitest";\nimport { sum } from "./sum";\nimport "./side";\nconst a = 1;';
    const { code, removed } = stripImports(input);
    expect(code).toBe("\n\n\nconst a = 1;");
    expect(removed).toHaveLength(3);
  });

  it("複数行 import と import type を除去する", () => {
    const input = 'import {\n  a,\n  b,\n} from "./x";\nimport type { T } from "./t";\nconst c = 1;';
    const { code } = stripImports(input);
    expect(code).toBe("\n\n\n\n\nconst c = 1;");
  });

  it("import を含まない行は触らない", () => {
    expect(stripImports("const important = 1;").code).toBe("const important = 1;");
  });
});

describe("stripExports", () => {
  it("宣言の export を剥がす", () => {
    const input = "export function f() {}\nexport const x = 1;\nexport async function g() {}\nexport default class C {}\nexport interface I {}";
    expect(stripExports(input).code).toBe("function f() {}\nconst x = 1;\nasync function g() {}\nclass C {}\ninterface I {}");
  });

  it("export default 式は const に置き換え、re-export は空行にする", () => {
    const input = 'export default sum;\nexport { a, b };\nexport * from "./x";';
    expect(stripExports(input).code).toBe("const __cjDefault = sum;\n\n");
  });
});

describe("stripCodeFence", () => {
  it("フェンス行だけを取り除く", () => {
    expect(stripCodeFence("```ts\nconst a = 1;\n```")).toBe("const a = 1;");
  });
});

describe("composeProgram", () => {
  it("プレリュード → 対象コード → テストコード → エピローグの順に合成する", () => {
    const { program, sourceStartLine } = composeProgram({ sourceCode: "export const a = 1;", testCode: 'import { it } from "vitest";\nit("x", () => {});' });
    expect(program.startsWith(CJ_HARNESS_PRELUDE)).toBe(true);
    expect(program.endsWith(CJ_HARNESS_EPILOGUE)).toBe(true);
    expect(program.indexOf("const a = 1;")).toBeLessThan(program.indexOf('it("x"'));
    expect(program).not.toContain("vitest");
    expect(program.split("\n")[sourceStartLine - 1]).toBe("const a = 1;");
  });
});

describe("composeBrainfuckProgram", () => {
  it("sourceCodeだけを実行プログラムとして返す", () => {
    const result = composeBrainfuckProgram({ sourceCode: "+++++.", testCode: "5" });
    expect(result.program).toBe("+++++.");
    expect(result.sourceStartLine).toBe(1);
  });
});
