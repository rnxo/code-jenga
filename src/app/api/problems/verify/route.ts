import { ApplicationError, toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyProblem } from "@/lib/server/piston/verify-problem";
import { enforceUserRateLimit } from "@/lib/server/rate-limit";

// POST /api/problems/verify?limit=N — 未検証のお題（is_verified=false）を Piston で事前検証する。
// シードお題（supabase/migrations/*_seed_problems.sql）の初回検証と、Gemini 障害時の手動リカバリに使う。
//   curl -X POST "http://localhost:3000/api/problems/verify?limit=3&after=<problem_id>" -b <認証 Cookie>
// 1 件の検証はセーフ行の算出（1 行ずつ削除して実行）を含むため Piston を 20〜30 回叩く。
// 1 リクエストで処理する件数を limit で絞り、却下されたお題（is_verified=false のまま残る）を
// 再処理しないよう id のカーソル（after）で進める（seed は同一 created_at で一括投入されるため id 順を使う）。呼び出し側（scripts/verify-seed-problems.ps1）は
// レスポンスの nextAfter を次回の after に渡し、remaining が 0 になるまでループする。
// 担当: BE-B

// Piston の実行（run 3秒 + compile 10秒 + 余裕）はリトライ込みで最大 36 秒程度かかるため、
// Vercel 関数の既定タイムアウトでは足りない。60 秒に延長する。
export const maxDuration = 60;

export interface VerifyProblemsResponse {
  verified: { problemId: string; safeLineCount: number }[];
  rejected: { problemId: string; reason: string }[];
  /** この呼び出しで処理した最後のお題の id。次回の after に渡す。処理対象が無ければ null。 */
  nextAfter: string | null;
  /** nextAfter より後に残っている未検証お題の件数。 */
  remaining: number;
}

const DEFAULT_LIMIT = 3;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMIT_RANGE = { min: 1, max: 20 } as const;

interface VerifyQuery {
  limit: number;
  /** この id より後（id 昇順）のお題だけを対象にする（却下済みを再処理しないためのカーソル）。 */
  after: string | null;
}

function parseQuery(request: Request): VerifyQuery {
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < LIMIT_RANGE.min || limit > LIMIT_RANGE.max) {
      throw new ApplicationError(
        "VALIDATION_ERROR",
        `limit は ${LIMIT_RANGE.min}〜${LIMIT_RANGE.max} の整数で指定してください。`,
      );
    }
  }
  const after = params.get("after");
  if (after !== null && !UUID_PATTERN.test(after)) {
    throw new ApplicationError("VALIDATION_ERROR", "after はお題の id（UUID）で指定してください。");
  }
  return { limit, after };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await requireUserId();
    enforceUserRateLimit(userId, "problem-verification");
    const { limit, after } = parseQuery(request);
    let query = createAdminClient()
      .from("problems")
      .select("id, source_code, test_code, language")
      .eq("is_verified", false)
      .order("id", { ascending: true });
    if (after !== null) {
      query = query.gt("id", after);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`未検証お題の取得に失敗しました: ${error.message}`);
    }

    const targets = data.slice(0, limit);
    const result: VerifyProblemsResponse = {
      verified: [],
      rejected: [],
      nextAfter: targets.length > 0 ? targets[targets.length - 1].id : null,
      remaining: data.length - targets.length,
    };
    for (const problem of targets) {
      const verification = await verifyProblem({
        problemId: problem.id,
        sourceCode: problem.source_code,
        testCode: problem.test_code,
        language: problem.language,
      });
      if (verification.verified) {
        result.verified.push({ problemId: problem.id, safeLineCount: verification.safeLineCount ?? 0 });
      } else {
        result.rejected.push({ problemId: problem.id, reason: verification.reason ?? "不明" });
      }
    }
    return toSuccessResponse(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
