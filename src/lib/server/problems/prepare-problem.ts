import "server-only";

import type { CodeLanguage, Problem } from "@/types/game";
import { DEFAULT_LANGUAGE, LANGUAGE_LABEL } from "@/lib/shared/language";
import { createProblem } from "@/lib/server/repositories/problems";
import { generateProblem } from "@/lib/server/gemini/generate-problem";
import { verifyProblem } from "@/lib/server/piston/verify-problem";

const MAX_GENERATION_ATTEMPTS = 3;

export async function generateVerifiedProblem(
  difficulty?: string,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): Promise<Problem | null> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const generated = await generateProblem(difficulty, language);
      const problem = await createProblem({
        sourceCode: generated.sourceCode,
        testCode: generated.testCode,
        // 生成結果の申告ではなく要求した言語を保存する（generateProblem が一致を保証している）。
        language,
        initialLineCount: generated.sourceCode.split("\n").length,
        generatedBy: "gemini",
        generationPrompt: generated.prompt,
      });
      const verification = await verifyProblem({
        problemId: problem.id,
        sourceCode: problem.source_code,
        testCode: problem.test_code,
        language: problem.language,
      });
      if (verification.verified) {
        return { ...problem, is_verified: true };
      }
    } catch (error) {
      // 次の生成候補へ進み、全試行失敗後に呼び出し側でフォールバックする。
      // 握りつぶすと「なぜ Python のお題が作れないのか」が追えなくなるのでログには残す。
      console.warn(
        `[prepare-problem] ${LANGUAGE_LABEL[language]} のお題生成に失敗しました（${attempt + 1}/${MAX_GENERATION_ATTEMPTS}回目）: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`,
      );
    }
  }
  return null;
}