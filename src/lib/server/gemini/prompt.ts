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
    "コードは最初は全テストが通り、sourceCodeの特定の1行を削除すると、テストの少なくとも1つが失敗する構造にしてください。",
    "削除対象となる1行は、関数の正しい動作に実質的に必要な処理であり、単なる構文上の必須行であってはいけません。",
    "削除対象の行が一見して分からないように、実際の処理に関係しない変数、定数、条件分岐、ヘルパー関数、コメント、空行などを適度に含めてください。",
    "ただし、追加するコードはTypeScriptとして自然に読める範囲にし、意味のないコードを大量に羅列しないでください。",
    "使われていない変数や関数を含めても構いませんが、ゲーム性を損なうほど多くしないでください。",
    "コメントアウトされたコードを少量含めても構いませんが、削除対象の行を直接示唆するコメントは禁止します。",
    "sourceCodeは15〜50行程度にしてください。",
    "関数そのものは短く保ち、コード全体の行数を増やすために不要な複雑化をしすぎないでください。",
    "テストコードは、削除対象の1行が正しく機能していることを間接的に検証できる内容にしてください。",
    "テストは同期的なdescribe / itのみを使ってください。",
    `expectで使えるマッチャーは次のものだけです: ${CJ_SUPPORTED_MATCHERS.join(", ")}`,
    "vi.mock、test.each、非同期テスト、ネットワークアクセス、外部パッケージ依存は使わないでください。",
    "対象コードとテストコードのトップレベル宣言名を重複させないでください。",
    "importはVitestと対象コードの参照だけにしてください。",
    "説明文、Markdownフェンスは含めないでください。",
    'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。',
    'language は "typescript" 固定です。'
  ].join("\n");
}
