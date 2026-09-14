import "server-only";

// 担当: BE-B
// Gemini へ渡すお題生成プロンプトを組み立てる。

/** difficulty（例: "easy"）に応じたお題生成プロンプトを組み立てる。 */
export function buildProblemGenerationPrompt(difficulty?: string): string {
  const requestedDifficulty = difficulty?.trim() || "easy";
  return [
    "あなたはTypeScriptの教材コードを作る専門家です。",
    `難易度は ${requestedDifficulty} です。`,
    "短いTypeScript関数と、その関数を検証するVitestテストを1組生成してください。",
    "コードは最初は全テストが通り、1行を削除すると失敗し得る構造にしてください。",
    "説明文、Markdownフェンス、import以外の外部依存、ネットワークアクセスは含めないでください。",
    'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。language は "typescript" 固定です。',
  ].join("\n");
}
