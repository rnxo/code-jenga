import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildProblemGenerationPrompt } = await import("./prompt");

describe("buildProblemGenerationPrompt", () => {
  it("既定は TypeScript のプロンプトを返す（言語追加前と同じ挙動）", () => {
    const prompt = buildProblemGenerationPrompt();
    expect(prompt).toContain("あなたはTypeScriptの教材コードを作る専門家です。");
    expect(prompt).toContain("難易度は easy です。");
    expect(prompt).toContain("Vitestテスト");
    expect(prompt).toContain('language は "typescript" 固定です。');
  });

  it("難易度を2行目に差し込む", () => {
    expect(buildProblemGenerationPrompt("hard").split("\n")[1]).toBe("難易度は hard です。");
    expect(buildProblemGenerationPrompt("  ").split("\n")[1]).toBe("難易度は easy です。");
  });

  it("Python では unittest の指示に切り替わる", () => {
    const prompt = buildProblemGenerationPrompt("normal", "python");
    expect(prompt).toContain("あなたはPythonの教材コードを作る専門家です。");
    expect(prompt).toContain("unittest.TestCase");
    expect(prompt).toContain("assertEqual");
    expect(prompt).toContain('language は "python" 固定です。');
    // 誤ってテストを2回走らせる原因になるので、書かせないことを明示している。
    expect(prompt).toContain("unittest.main()");
    expect(prompt).not.toContain("Vitest");
  });
});
