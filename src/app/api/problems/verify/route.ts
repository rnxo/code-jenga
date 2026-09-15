import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyProblem } from "@/lib/server/piston/verify-problem";

// POST /api/problems/verify — 未検証のお題（is_verified=false）をまとめて Piston で事前検証する。
// シードお題（supabase/migrations/*_seed_problems.sql）の初回検証と、Gemini 障害時の手動リカバリに使う。
//   curl -X POST http://localhost:3000/api/problems/verify -b <認証 Cookie>
// 担当: BE-B

export interface VerifyProblemsResponse {
  verified: string[];
  rejected: { problemId: string; reason: string }[];
}

export async function POST(): Promise<Response> {
  try {
    await requireUserId();
    const { data, error } = await createAdminClient()
      .from("problems")
      .select("id, source_code, test_code, language")
      .eq("is_verified", false);
    if (error) {
      throw new Error(`未検証お題の取得に失敗しました: ${error.message}`);
    }

    const result: VerifyProblemsResponse = { verified: [], rejected: [] };
    for (const problem of data) {
      const verification = await verifyProblem({
        problemId: problem.id,
        sourceCode: problem.source_code,
        testCode: problem.test_code,
        language: problem.language,
      });
      if (verification.verified) {
        result.verified.push(problem.id);
      } else {
        result.rejected.push({ problemId: problem.id, reason: verification.reason ?? "不明" });
      }
    }
    return toSuccessResponse(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
