import "server-only";

import { CJ_SUPPORTED_MATCHERS } from "@/lib/server/piston/harness";

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
    "sourceCodeは15〜40行程度にしてください。テストは同期的な describe / it のみを使ってください。",
    `expectで使えるマッチャーは次のものだけです: ${CJ_SUPPORTED_MATCHERS.join(", ")}`,
    "vi.mock、test.each、非同期テスト、ネットワークアクセス、外部パッケージ依存は使わないでください。",
    "対象コードとテストコードのトップレベル宣言名を重複させないでください。",
    "説明文、Markdownフェンスは含めないでください。importはVitestと対象コードの参照だけにしてください。",
    'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。language は "typescript" 固定です。',
  ].join("\n");
}
