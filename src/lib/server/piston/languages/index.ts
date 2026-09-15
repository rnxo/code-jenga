// 担当: BE-B
// 対応言語のレジストリ。run.ts と prompt.ts はここ経由で言語ごとの差分を引く。
// 純粋モジュール（"server-only" を付けない）。

import type { CodeLanguage } from "@/types/game";
import { SUPPORTED_LANGUAGES, normalizeLanguageId } from "@/lib/shared/language";
import { PYTHON_LANGUAGE } from "./python";
import { TYPESCRIPT_LANGUAGE } from "./typescript";
import type { LanguageDefinition } from "./types";

export type { LanguageDefinition, LanguagePromptSection } from "./types";
export { resolvePistonLanguageOverride, resolvePistonVersionOverride, type EnvSource } from "./env";

const REGISTRY: Readonly<Record<CodeLanguage, LanguageDefinition>> = {
  typescript: TYPESCRIPT_LANGUAGE,
  python: PYTHON_LANGUAGE,
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
