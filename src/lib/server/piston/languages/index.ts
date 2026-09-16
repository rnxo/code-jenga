// 担当: BE-B
// 対応言語のレジストリ。run.ts と prompt.ts はここ経由で言語ごとの差分を引く。
// 純粋モジュール（"server-only" を付けない）。

import type { CodeLanguage } from "@/types/game";
import { SUPPORTED_LANGUAGES, normalizeLanguageId } from "@/lib/shared/language";
import { PYTHON_LANGUAGE } from "./python";
import { TYPESCRIPT_LANGUAGE } from "./typescript";
import { composeBrainfuckProgram } from "../compose-brainfuck";
import type { LanguageDefinition } from "./types";

const BRAINFUCK_LANGUAGE: LanguageDefinition = {
  id: "brainfuck",
  pistonLanguage: "brainfuck",
  defaultVersion: "*",
  fileName: "main.bf",
  envSuffix: "BRAINFUCK",
  testStrategy: "stdout",
  compose: composeBrainfuckProgram,
  prompt: {
    roleLine: "あなたはBrainfuckの教材コードを作る専門家です。",
    rules: [
      "短いBrainfuckプログラムと、そのプログラムを検証するテストコードを1組生成してください。",
      "コードは最初は全テストが通るようにしてください。",
      "ゲームとして、sourceCodeには『削除してもテスト結果が変わらない命令・行』を多数含めてください。",
      "プレイヤーはsourceCodeから任意の1行を選んで削除するため、ほとんどの行を削除しても全テストが通り、一部の重要な行を削除した場合だけテストが失敗する構造にしてください。",
      "テストを失敗させる可能性がある重要な行はsourceCode全体で1行だけにしてください。",
      "その重要な1行は、プログラムの正しい動作に実質的に必要なBrainfuck命令列を含む行であり、単なる構文上の必須行や改行ではありません。",
      "重要な1行が一見して分からないように、実際の出力や計算結果に影響しないBrainfuck命令、コメント、ポインタ移動、値の調整、空行などを適度に含めてください。",
      "重要な1行以外の行は、削除しても既存のテストがすべて成功するようにしてください。",
      "1行消しただけでプログラムの構造が壊れて実行不能になるような構成は避けてください。",
      "sourceCodeは15〜50行程度にしてください。",
      "プログラムそのものは短く保ち、コード全体の行数を増やすために不要な複雑化をしすぎないでください。",
      "Brainfuckとして自然に読める範囲のプログラムにしてください。",
      "Brainfuckの有効な命令は > < + - . , [ ] のみとし、それ以外の文字はコメントとして扱われる前提にしてください。",
      "入力を必要とする場合は、テスト側から決められた入力を与えられる構造にしてください。",
      "テストコードは、重要な1行が正しく機能していることを検証できる内容にしてください。",
      "テストでは、標準的なBrainfuckインタプリタを使ってsourceCodeを実行し、期待する出力と実際の出力を比較してください。",
      "テストコード側では、sourceCodeを対象プログラムとして直接実行できるようにしてください。",
      "外部パッケージやネットワークアクセス、ファイルアクセスは使わないでください。",
      "テスト用のBrainfuckインタプリタは必要最小限の実装にしてください。",
      "テストコード内のトップレベル定義名とsourceCode側のコメントや識別用名称が衝突しないようにしてください。",
      "プログラムの実行結果は決定的で、同じ入力に対して常に同じ出力になるようにしてください。",
      "重要な1行を削除すると期待出力と異なる結果になり、テストが失敗することを確認できる構造にしてください。",
      "重要な1行以外の任意の1行を削除した場合には、既存のテストがすべて成功するようにしてください。",
      "重要な1行を単独で見ても、それが正解に必要な行だと容易には判断できないようにしてください。",
      "コメントだけの行や空行を含めても構いませんが、ゲーム性を損なうほど多くしないでください。",
      "意味のない命令を大量に羅列するのではなく、Brainfuckとしてある程度自然なプログラムにしてください。",
      "説明文、Markdownフェンスは含めないでください。",
      'JSONのみで返し、キーは \"sourceCode\", \"testCode\", \"language\" としてください。',
      'language は \"brainfuck\" 固定です。'
    ],
  },
};

export type { LanguageDefinition, LanguagePromptSection } from "./types";
export { resolvePistonLanguageOverride, resolvePistonVersionOverride, type EnvSource } from "./env";

const REGISTRY: Readonly<Record<CodeLanguage, LanguageDefinition>> = {
  typescript: TYPESCRIPT_LANGUAGE,
  python: PYTHON_LANGUAGE,
  brainfuck: BRAINFUCK_LANGUAGE,
};

/** 対応言語の定義を取り出す（CodeLanguage が確定している場合はこちら）。 */
export function getLanguageDefinition(language: CodeLanguage): LanguageDefinition {
  return REGISTRY[language];
}

/**
 * problems.language のような緩い文字列から言語定義を解決する。
 * 判別できない値は握りつぶさず throw する（未対応言語のお題が TypeScript として
 * 実行されると、プレイヤーには理由の分からないアウトになるため）。
 */
export function resolveLanguage(language: string): LanguageDefinition {
  const normalized = normalizeLanguageId(language);
  if (normalized === null) {
    throw new Error(
      `未対応の実行言語です: "${language}"。対応しているのは ${SUPPORTED_LANGUAGES.join(" / ")} です。`,
    );
  }
  return REGISTRY[normalized];
}
