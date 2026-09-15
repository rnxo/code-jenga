import "server-only";

import type { CodeLanguage } from "@/types/game";
import { DEFAULT_LANGUAGE } from "@/lib/shared/language";
import { getLanguageDefinition } from "@/lib/server/piston/languages";

// 担当: BE-B
// Gemini へ渡すお題生成プロンプトを組み立てる。
//
// 言語ごとに変わる文面（役割の宣言と各種制約）は
// src/lib/server/piston/languages/ の言語定義が持つ。ここは難易度の行を挟んで結合するだけにして、
// 言語を増やしてもこのファイルを触らずに済むようにしている。

/** difficulty（例: "easy"）と言語に応じたお題生成プロンプトを組み立てる。 */
export function buildProblemGenerationPrompt(difficulty?: string, language: CodeLanguage = DEFAULT_LANGUAGE): string {
  const requestedDifficulty = difficulty?.trim() || "easy";
  const { prompt } = getLanguageDefinition(language);
  return [prompt.roleLine, `難易度は ${requestedDifficulty} です。`, ...prompt.rules].join("\n");
}
