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
      "BrainfuckのsourceCodeと、sourceCodeを実行したときに得られる期待標準出力だけを生成してください。",
      "testCodeには期待標準出力をそのまま入れてください。JSONやMarkdownフェンスは含めないでください。",
      "sourceCodeはBrainfuckの8命令（+ - < > [ ] . ,）以外の文字もコメントとして使えます。",
      "sourceCodeは15〜50行程度にし、削除しても出力が変わらないコメント行を多数含めてください。",
      "重要な処理はsourceCode全体で1行だけにし、その行を削除した場合だけ期待出力と一致しない構造にしてください。",
      "重要な行以外の行を削除しても、期待標準出力が変わらないようにしてください。",
      "無限ループ、入力待ち、外部アクセスは使わないでください。",
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
