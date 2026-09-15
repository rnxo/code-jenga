import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABEL,
  MONACO_LANGUAGE_ID,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  normalizeLanguageId,
  toCodeLanguage,
} from "./language";

describe("isSupportedLanguage", () => {
  it("対応言語だけを受け入れる", () => {
    expect(isSupportedLanguage("typescript")).toBe(true);
    expect(isSupportedLanguage("python")).toBe(true);
  });

  it("未対応の値・文字列以外は弾く", () => {
    expect(isSupportedLanguage("ruby")).toBe(false);
    expect(isSupportedLanguage("Python")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
    expect(isSupportedLanguage(1)).toBe(false);
  });
});

describe("normalizeLanguageId", () => {
  it("判別できない値は null を返す（握りつぶさない用）", () => {
    expect(normalizeLanguageId("ruby")).toBeNull();
    expect(normalizeLanguageId("")).toBeNull();
    expect(normalizeLanguageId(null)).toBeNull();
  });

  it("対応言語と別名は正規化する", () => {
    expect(normalizeLanguageId("Python")).toBe("python");
    expect(normalizeLanguageId("typescript")).toBe("typescript");
  });
});

describe("toCodeLanguage", () => {
  it("Gemini が返しがちな表記ゆれを正規化する", () => {
    expect(toCodeLanguage("Python")).toBe("python");
    expect(toCodeLanguage("python3")).toBe("python");
    expect(toCodeLanguage("  PY  ")).toBe("python");
    expect(toCodeLanguage("TypeScript")).toBe("typescript");
    expect(toCodeLanguage("ts")).toBe("typescript");
  });

  it("判別できない値は既定言語に倒す", () => {
    expect(toCodeLanguage("ruby")).toBe(DEFAULT_LANGUAGE);
    expect(toCodeLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(toCodeLanguage(42)).toBe(DEFAULT_LANGUAGE);
  });
});

describe("表の網羅性", () => {
  it("対応言語すべてにラベルと Monaco の language ID がある", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_LABEL[language]).toBeTruthy();
      expect(MONACO_LANGUAGE_ID[language]).toBeTruthy();
    }
  });

  it("既定言語は対応言語に含まれる", () => {
    expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });
});
