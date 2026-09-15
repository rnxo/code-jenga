// 担当: BE-B
// Python の言語定義。
//
// テストは標準ライブラリの unittest で書かせる。Piston には pip もネットワークも無いため
// pytest は使えず、また自作の expect シムを持ち込むと Gemini が慣れていない独自 DSL になり
// 生成の失敗率が上がるため、言語標準の書き方に寄せている。
// 純粋モジュール（"server-only" を付けない）。

import { composePythonProgram } from "../compose-python";
import { CJ_PY_SUPPORTED_ASSERTIONS } from "../harness-python";
import type { LanguageDefinition } from "./types";

export const PYTHON_LANGUAGE: LanguageDefinition = {
  id: "python",
  pistonLanguage: "python",
  // Piston の /packages に "*" は使えないので、インストール済みの具体的なバージョンに寄せる。
  // 実行時は "*" でも解決できるため、ここは最新一致に任せる。
  defaultVersion: "*",
  fileName: "main.py",
  envSuffix: "PYTHON",
  compose: composePythonProgram,
  prompt: {
    roleLine: "あなたはPythonの教材コードを作る専門家です。",
    rules: [
      "短いPython関数と、その関数を検証する unittest のテストを1組生成してください。",
      "コードは最初は全テストが通るようにしてください。",
      "ゲームとして、sourceCodeには『削除してもテスト結果が変わらない行』を多数含めてください。",
      "プレイヤーはsourceCodeから任意の1行を選んで削除するため、ほとんどの行を削除しても全テストが通り、一部の重要な行を削除した場合だけテストが失敗する構造にしてください。",
      "テストを失敗させる可能性がある重要な行はsourceCode全体で1行だけにしてください。",
      "その重要な1行は、関数の正しい動作に実質的に必要な処理であり、単なる構文上の必須行であってはいけません。",
      "重要な1行が一見して分からないように、実際の処理に影響しない変数、定数、条件分岐、ヘルパー関数、コメント、空行などを適度に含めてください。",
      "重要な1行以外の行は、削除しても既存の unittest のテストがすべて成功するようにしてください。",
      "1行消しただけでインデントが壊れて SyntaxError になる構造（本体が1行だけのブロックなど）は避け、関数やブロックの本体は2行以上にしてください。",
      "追加するコードはPythonとして自然に読める範囲にし、意味のないコードを大量に羅列しないでください。",
      "使われていない変数や関数を含めても構いませんが、ゲーム性を損なうほど多くしないでください。",
      "コメントアウトされたコードを少量含めても構いませんが、重要な1行を直接示唆するコメントは禁止します。",
      "sourceCodeは15〜50行程度にしてください。",
      "関数そのものは短く保ち、コード全体の行数を増やすために不要な複雑化をしすぎないでください。",
      "テストコードは、重要な1行が正しく機能していることを検証できる内容にしてください。",
      "テストは unittest.TestCase を継承したクラスと、test_ で始まるメソッドで書いてください。",
      `使ってよいアサーションは次のものだけです: ${CJ_PY_SUPPORTED_ASSERTIONS.join(", ")}`,
      "pytest、モジュール直下の assert 文、モック、async、ファイル・ネットワークアクセス、外部パッケージは使わないでください。",
      "import は import unittest だけにし、ファイル先頭のインデント無しの位置に書いてください。対象コードを import してはいけません（同じファイルに連結されます）。",
      'if __name__ == "__main__": や unittest.main() は書かないでください。テストの実行はこちらで行います。',
      "print、input、sys の使用は禁止です。",
      "型ヒントは使ってかまいませんが、typing の import は避けてください。",
      "対象コードとテストコードのトップレベル定義名を重複させないでください。",
      "説明文、Markdownフェンスは含めないでください。",
      'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。',
      'language は "python" 固定です。',
    ],
  },
};
