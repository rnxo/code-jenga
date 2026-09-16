import "server-only";

import type { CodeLanguage } from "@/types/game";
import { getServerEnv } from "@/lib/server/env";
import { DEFAULT_LANGUAGE, normalizeLanguageId } from "@/lib/shared/language";
import { runBrainfuck } from "@/lib/server/piston/brainfuck-interpreter";
import { buildProblemGenerationPrompt } from "./prompt";

// 担当: BE-B
// DB_DESIGN.md 5章-2: Gemini にプロンプトを投げてコード＋テストコードを取得する。
// 取得後は @/lib/server/repositories/problems の createProblem で保存し、
// @/lib/server/piston/run で事前検証してから is_verified=true にする（呼び出し側の責務）。

export interface GeneratedProblem {
  sourceCode: string;
  testCode: string;
  language: CodeLanguage;
  prompt: string;
}

// Gemini にお題生成プロンプトを投げて、コード＋テストコードを取得する。
export async function generateProblem(
  difficulty?: string,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): Promise<GeneratedProblem> {
  const prompt = buildProblemGenerationPrompt(difficulty, language);
  const { GEMINI_API_KEY } = getServerEnv();
  // gemini-2.5-flash は 2026/9 時点で新規ユーザーへの提供が終了し 404 を返すため、後継の 3.6-flash を既定にする。
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let response: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        throw new Error(`Gemini API に接続できませんでした: ${error instanceof Error ? error.message : "不明なエラー"}`);
      }
    }
  }
  if (!response) {
    throw new Error(`Gemini API に接続できませんでした: ${lastError instanceof Error ? lastError.message : "不明なエラー"}`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Gemini API の呼び出しに失敗しました（${response.status}）: ${detail}`);
  }

  const payload: unknown = await response.json();
  const text = readGeminiText(payload);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini の応答を JSON として解析できませんでした。");
  }
  if (!isGeneratedProblem(parsed, language)) {
    throw new Error(
      `Gemini の応答に sourceCode、testCode、language が ${language} として正しく含まれていません。`,
    );
  }
  if (language === "brainfuck") {
    // Brainfuck は testCode を期待標準出力として比較する（testStrategy: "stdout"）。
    // Gemini は ASCII の加減算を間違えやすく、申告した期待出力が実際の出力とずれることが多いので、
    // サーバー内のインタプリタで実行した結果を期待出力として採用する（合否判定自体は Piston の検証が行う）。
    const executed = runBrainfuck(parsed.sourceCode);
    if (!executed.ok) {
      throw new Error(`Gemini が生成した Brainfuck コードを実行できませんでした: ${executed.reason}`);
    }
    if (executed.output.trim() === "") {
      throw new Error("Gemini が生成した Brainfuck コードは何も出力しません。");
    }
    if (executed.output !== parsed.testCode) {
      console.warn(
        `[generate-problem] Brainfuck の期待出力を Gemini の申告（${JSON.stringify(parsed.testCode.slice(0, 40))}）から実行結果（${JSON.stringify(executed.output)}）へ置き換えました。`,
      );
    }
    return { sourceCode: parsed.sourceCode, testCode: executed.output, language, prompt };
  }
  // language は要求値で確定させる（型ガードで一致を確認済み）。Gemini の表記ゆれを DB に持ち込まない。
  return { sourceCode: parsed.sourceCode, testCode: parsed.testCode, language, prompt };
}

/** Geminiレスポンスから生成本文を取り出す。 */
function readGeminiText(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new Error("Gemini の応答形式が不正です。");
  }
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0 || !isRecord(candidates[0])) {
    throw new Error("Gemini の応答に候補がありません。");
  }
  const content = candidates[0].content;
  if (!isRecord(content) || !Array.isArray(content.parts) || !isRecord(content.parts[0])) {
    throw new Error("Gemini の応答本文が空です。");
  }
  const text = content.parts[0].text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Gemini の応答本文が空です。");
  }
  return text.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
}

/** unknown値がオブジェクトであることを確認する。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Geminiが返した問題データの最小形式を検証する。
 * language は要求した言語と一致していることまで確かめる（"Python" / "python3" の表記ゆれは吸収する）。
 * 別言語が返ってきた場合は、そのままお題にすると実行時に必ず壊れるので不合格にする。
 */
function isGeneratedProblem(
  value: unknown,
  expected: CodeLanguage,
): value is { sourceCode: string; testCode: string; language: string } {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sourceCode === "string" &&
    value.sourceCode.trim().length > 0 &&
    typeof value.testCode === "string" &&
    value.testCode.trim().length > 0 &&
    normalizeLanguageId(value.language) === expected
  );
}
