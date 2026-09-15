// 担当: BE-B
// TypeScript（Piston 上では deno ランタイム）の言語定義。
//
// プロンプト文面は develop の prompt.ts（ゲーム性重視版: 「削除してもテストが変わらない行」を
// 多数含め、重要な行は1行だけにする）をそのまま言語定義へ移したもの。
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
      "コードは最初は全テストが通るようにしてください。",
      "ゲームとして、sourceCodeには『削除してもテスト結果が変わらない行』を多数含めてください。",
      "プレイヤーはsourceCodeから任意の1行を選んで削除するため、ほとんどの行を削除しても全テストが通り、一部の重要な行を削除した場合だけテストが失敗する構造にしてください。",
      "テストを失敗させる可能性がある重要な行はsourceCode全体で1行だけにしてください。",
      "その重要な1行は、関数の正しい動作に実質的に必要な処理であり、単なる構文上の必須行であってはいけません。",
      "重要な1行が一見して分からないように、実際の処理に影響しない変数、定数、条件分岐、ヘルパー関数、コメント、空行などを適度に含めてください。",
      "重要な1行以外の行は、削除しても既存のVitestテストがすべて成功するようにしてください。",
      "ただし、重要な1行以外をすべて削除してもTypeScriptとして構文エラーになってしまうような必須構文は、ゲーム上の『重要な1行』として扱わないでください。",
      "追加するコードはTypeScriptとして自然に読める範囲にし、意味のないコードを大量に羅列しないでください。",
      "使われていない変数や関数を含めても構いませんが、ゲーム性を損なうほど多くしないでください。",
      "コメントアウトされたコードを少量含めても構いませんが、重要な1行を直接示唆するコメントは禁止します。",
      "sourceCodeは15〜50行程度にしてください。",
      "関数そのものは短く保ち、コード全体の行数を増やすために不要な複雑化をしすぎないでください。",
      "テストコードは、重要な1行が正しく機能していることを検証できる内容にしてください。",
      "テストは同期的なdescribe / itのみを使ってください。",
      `expectで使えるマッチャーは次のものだけです: ${CJ_SUPPORTED_MATCHERS.join(", ")}`,
      "vi.mock、test.each、非同期テスト、ネットワークアクセス、外部パッケージ依存は使わないでください。",
      "対象コードとテストコードのトップレベル宣言名を重複させないでください。",
      "importはVitestと対象コードの参照だけにしてください。",
      "説明文、Markdownフェンスは含めないでください。",
      'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。',
      'language は "typescript" 固定です。',
    ],
  },
};
