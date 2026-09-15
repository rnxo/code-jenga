// 担当: BE-B
// TypeScript（Piston 上では deno ランタイム）の言語定義。
//
// 既存の compose.ts / harness.ts / prompt.ts の挙動をそのまま写しただけで、変更は加えていない。
// 言語追加にあたって TypeScript 経路を非破壊に保つことが最優先のため、文言も一字一句そのままにする。
// 純粋モジュール（"server-only" を付けない）。

import { composeProgram } from "../compose";
import { CJ_SUPPORTED_MATCHERS } from "../harness";
import type { LanguageDefinition } from "./types";

export const TYPESCRIPT_LANGUAGE: LanguageDefinition = {
  id: "typescript",
  // language=typescript version=* だと tsc 5.0.3（target ES5）が選ばれるため deno を使う。
  // deno は型チェック無し・compile ステージ無しで判定が単純になる。
  pistonLanguage: "deno",
  defaultVersion: "*",
  fileName: "main.ts",
  envSuffix: "TYPESCRIPT",
  compose: composeProgram,
  prompt: {
    roleLine: "あなたはTypeScriptの教材コードを作る専門家です。",
    rules: [
      "短いTypeScript関数と、その関数を検証するVitestテストを1組生成してください。",
      "コードは最初は全テストが通り、1行を削除すると失敗し得る構造にしてください。",
      "sourceCodeは15〜40行程度にしてください。テストは同期的な describe / it のみを使ってください。",
      `expectで使えるマッチャーは次のものだけです: ${CJ_SUPPORTED_MATCHERS.join(", ")}`,
      "vi.mock、test.each、非同期テスト、ネットワークアクセス、外部パッケージ依存は使わないでください。",
      "対象コードとテストコードのトップレベル宣言名を重複させないでください。",
      "説明文、Markdownフェンスは含めないでください。importはVitestと対象コードの参照だけにしてください。",
      'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。language は "typescript" 固定です。',
    ],
  },
};
