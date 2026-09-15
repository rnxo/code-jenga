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
      "コードは最初は全テストが通り、1行を削除すると失敗し得る構造にしてください。",
      "テストは unittest.TestCase を継承したクラスと、test_ で始まるメソッドで書いてください。",
      `使ってよいアサーションは次のものだけです: ${CJ_PY_SUPPORTED_ASSERTIONS.join(", ")}`,
      "pytest、モジュール直下の assert 文、モック、async、ファイル・ネットワークアクセス、外部パッケージは使わないでください。",
      "import は import unittest だけにし、ファイル先頭のインデント無しの位置に書いてください。対象コードを import してはいけません（同じファイルに連結されます）。",
      'if __name__ == "__main__": や unittest.main() は書かないでください。テストの実行はこちらで行います。',
      "print、input、sys の使用は禁止です。",
      "sourceCodeは15〜40行程度にしてください。1行消しただけでインデントが壊れないよう、関数の本体は2行以上にしてください。",
      "型ヒントは使ってかまいませんが、typing の import は避けてください。",
      "対象コードとテストコードのトップレベル定義名を重複させないでください。",
      "説明文、Markdownフェンスは含めないでください。",
      'JSONのみで返し、キーは "sourceCode", "testCode", "language" としてください。language は "python" 固定です。',
    ],
  },
};
