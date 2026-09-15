import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "@/lib/shared/language";
import { getLanguageDefinition, resolveLanguage } from "./index";
import { resolvePistonLanguageOverride, resolvePistonVersionOverride, type EnvSource } from "./env";

describe("resolveLanguage", () => {
  it("対応言語を解決する", () => {
    expect(resolveLanguage("typescript").pistonLanguage).toBe("deno");
    expect(resolveLanguage("python").pistonLanguage).toBe("python");
  });

  it("表記ゆれを吸収する", () => {
    expect(resolveLanguage("Python").id).toBe("python");
    expect(resolveLanguage(" TypeScript ").id).toBe("typescript");
  });

  it("未対応の言語は意味のあるメッセージ付きで throw する", () => {
    expect(() => resolveLanguage("ruby")).toThrowError(/未対応の実行言語です: "ruby"/);
    expect(() => resolveLanguage("ruby")).toThrowError(/typescript \/ python/);
  });
});

describe("言語定義の網羅性", () => {
  it("対応言語すべてに定義があり、送信ファイル名が重複しない", () => {
    const fileNames = SUPPORTED_LANGUAGES.map((language) => {
      const definition = getLanguageDefinition(language);
      expect(definition.id).toBe(language);
      expect(definition.prompt.rules.length).toBeGreaterThan(0);
      return definition.fileName;
    });
    expect(new Set(fileNames).size).toBe(fileNames.length);
  });
});

describe("環境変数の上書き", () => {
  const typescript = getLanguageDefinition("typescript");
  const python = getLanguageDefinition("python");

  it("旧 PISTON_LANGUAGE は typescript にだけ効く（python が deno に送られる事故を防ぐ）", () => {
    const env = { PISTON_LANGUAGE: "deno", PISTON_LANGUAGE_VERSION: "*" } satisfies EnvSource;
    expect(resolvePistonLanguageOverride(typescript, env)).toBe("deno");
    expect(resolvePistonLanguageOverride(python, env)).toBeUndefined();
    expect(resolvePistonVersionOverride(python, env)).toBeUndefined();
  });

  it("言語別の上書きは旧変数より優先される", () => {
    const env = {
      PISTON_LANGUAGE: "deno",
      PISTON_LANGUAGE_TYPESCRIPT: "typescript",
      PISTON_LANGUAGE_PYTHON: "python",
      PISTON_LANGUAGE_VERSION_PYTHON: "3.12.0",
    } satisfies EnvSource;
    expect(resolvePistonLanguageOverride(typescript, env)).toBe("typescript");
    expect(resolvePistonLanguageOverride(python, env)).toBe("python");
    expect(resolvePistonVersionOverride(python, env)).toBe("3.12.0");
  });

  it("空文字は未設定として扱う", () => {
    expect(resolvePistonLanguageOverride(typescript, { PISTON_LANGUAGE: "  " } satisfies EnvSource)).toBeUndefined();
  });
});
