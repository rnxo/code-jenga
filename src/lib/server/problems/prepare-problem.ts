import "server-only";

import type { Problem } from "@/types/game";
import { createProblem } from "@/lib/server/repositories/problems";
import { generateProblem } from "@/lib/server/gemini/generate-problem";
import { verifyProblem } from "@/lib/server/piston/verify-problem";

const MAX_GENERATION_ATTEMPTS = 3;

export async function generateVerifiedProblem(difficulty?: string): Promise<Problem | null> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const generated = await generateProblem(difficulty);
      const problem = await createProblem({
        sourceCode: generated.sourceCode,
        testCode: generated.testCode,
        language: generated.language,
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
    } catch {
      // 次の生成候補へ進み、全試行失敗後に呼び出し側でフォールバックする。
    }
  }
  return null;
}