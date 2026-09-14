import "server-only";

import { getServerEnv } from "@/lib/server/env";
import { buildProblemGenerationPrompt } from "./prompt";

// 担当: BE-B
// DB_DESIGN.md 5章-2: Gemini にプロンプトを投げてコード＋テストコードを取得する。
// 取得後は @/lib/server/repositories/problems の createProblem で保存し、
// @/lib/server/piston/run で事前検証してから is_verified=true にする（呼び出し側の責務）。

export interface GeneratedProblem {
  sourceCode: string;
  testCode: string;
  language: string;
}

export async function generateProblem(difficulty?: string): Promise<GeneratedProblem> {
  const prompt = buildProblemGenerationPrompt(difficulty);
  const { GEMINI_API_KEY } = getServerEnv();
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const detail = await response.text();
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
  if (!isGeneratedProblem(parsed)) {
    throw new Error("Gemini の応答に sourceCode、testCode、language が正しく含まれていません。");
  }
  return parsed;
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

/** Geminiが返した問題データの最小形式を検証する。 */
function isGeneratedProblem(value: unknown): value is GeneratedProblem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sourceCode === "string" &&
    value.sourceCode.trim().length > 0 &&
    typeof value.testCode === "string" &&
    value.testCode.trim().length > 0 &&
    typeof value.language === "string" &&
    value.language === "typescript"
  );
}
