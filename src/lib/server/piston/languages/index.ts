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
      // testStrategy が "stdout" のため、testCode は「テストコード」ではなく「期待標準出力」そのもの。
      // テストハーネスやインタプリタを書かせると応答が長くなって 30 秒のタイムアウトに掛かり、
      // 返ってきても標準出力と一致せず検証で必ず落ちる（過去にそうなって生成が全滅した）。
      "短いBrainfuckプログラム（sourceCode）と、それを実行したときの期待標準出力（testCode）を1組生成してください。",
      "testCodeは期待標準出力の文字列そのものだけにしてください。テストコード・インタプリタ・説明文・Markdownフェンスは絶対に入れないでください。",
      "sourceCodeの各行は8命令（+ - < > [ ] . ,）だけで構成してください。説明文・コメント・空行は入れないでください（[ ] を含むコメントはループとして実行されてしまいます）。",
      "sourceCodeは12〜20行にし、1行は1〜60文字程度にしてください。",
      "ゲームとして、プレイヤーはsourceCodeから任意の1行を選んで削除します。行の半数程度は『削除しても期待標準出力が変わらない実際の命令列』にしてください（例: +- / -+ / >< / <> / >+< と >-< の組 / 未使用セルに対する >[-]< / 値が0のセルに対する [-]）。",
      "残りの行（4行以上）は値の構築・ループ・出力（.）を担う重要な行にし、そのいずれか1行を削除すると期待標準出力が変わる構造にしてください。",
      "重要な行は複数行に分散させ、1行にまとめないでください。重要な行を単独で見ても、それが必要な行だと容易には判断できないようにしてください。",
      "1行消しただけで [ と ] の対応が壊れて実行不能になる構成は避けてください（[ と ] は必ず同じ行に置く）。",
      "無限ループ、入力命令（,）、外部アクセスは使わないでください。出力は決定的にしてください。",
      "出力は英数字と記号からなる1〜5文字程度の短い文字列にしてください。",
      "説明文は含めず、キーがsourceCode、testCode、languageのJSONだけを返してください。",
      "languageは\"brainfuck\"固定です。",
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
