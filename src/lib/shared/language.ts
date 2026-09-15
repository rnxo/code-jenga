// 実行言語（TypeScript / Python）に関する定数と純粋関数群。
// FE / BE どちらからも import してよい（"server-only" な依存を持ち込まないこと）。
//
// 言語ごとに変わる「実行の仕方」（Piston のランタイム名・テストハーネス・お題生成プロンプト）は
// src/lib/server/piston/languages/ 側にまとめている。ここには FE でも要る最小限だけを置く。

import type { CodeLanguage } from "@/types/game";

/** 対応している実行言語。UI の選択肢の並び順もこの順に従う。 */
export const SUPPORTED_LANGUAGES = ["typescript", "python", "brainfuck"] as const satisfies readonly CodeLanguage[];

/** 未指定・不明な値のフォールバック先。既存の試合はすべてこの言語で動いていた。 */
export const DEFAULT_LANGUAGE: CodeLanguage = "typescript";

/** unknown を CodeLanguage に絞り込む型ガード（any は使わない / CLAUDE.md）。 */
export function isSupportedLanguage(value: unknown): value is CodeLanguage {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** 表記ゆれの吸収表。Gemini が "Python" / "python3" と返す事故に備える。 */
const LANGUAGE_ALIASES: Readonly<Record<string, CodeLanguage>> = {
  ts: "typescript",
  typescript: "typescript",
  python: "python",
  python3: "python",
  py: "python",
  brainfuck: "brainfuck",
  bf: "brainfuck",
};

/**
 * problems.language（CHECK 制約の無い text）のような緩い値を CodeLanguage に正規化する。
 * 判別できなければ null を返すので、握りつぶしたくない呼び出し側はこちらを使う。
 */
export function normalizeLanguageId(value: unknown): CodeLanguage | null {
  if (typeof value !== "string") {
    return null;
  }
  return LANGUAGE_ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * normalizeLanguageId と同じだが、判別できない値を DEFAULT_LANGUAGE に倒す。
 * 表示など「止めるほどではない」場面で使う。
 */
export function toCodeLanguage(value: unknown): CodeLanguage {
  return normalizeLanguageId(value) ?? DEFAULT_LANGUAGE;
}

/** UI 表示用ラベル。 */
export const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  typescript: "TypeScript",
  python: "Python",
  brainfuck: "Brainfuck",
};

/**
 * Monaco Editor の language ID。
 * DB の enum とは別概念なので、CodeViewer へ渡すときは必ずこの表を通すこと。
 */
export const MONACO_LANGUAGE_ID: Record<CodeLanguage, string> = {
  typescript: "typescript",
  python: "python",
  brainfuck: "brainfuck",
};
