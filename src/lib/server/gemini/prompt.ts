import "server-only";

// 担当: BE-B
// Gemini へ渡すお題生成プロンプトを組み立てる。

/** difficulty（例: "easy"）に応じたお題生成プロンプトを組み立てる。 */
export function buildProblemGenerationPrompt(difficulty?: string): string {
  throw new Error(`未実装: buildProblemGenerationPrompt(${difficulty ?? "未指定"})`);
}
