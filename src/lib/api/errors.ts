// Route Handler（src/app/api/**）向けのエラー整形ユーティリティ。
// ApiResult<T> の判別共用体を一貫して返すために使う。

import type { ApiError, ApiErrorCode, ApiResult } from "@/types/api";

/** Route Handler 内で意図的に投げる業務エラー。code で HTTP ステータスと分類を決める。 */
export class ApplicationError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
  }
}

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  NOT_YOUR_TURN: 403,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_CLOSED: 409,
  GAME_NOT_READY: 409,
  GAME_NOT_FOUND: 404,
  GAME_NOT_PLAYING: 409,
  INVALID_LINE: 400,
  // 行番号は範囲内だが、その手のターン難易度（縛り）では削除できない行を指定した場合。
  LINE_NOT_DELETABLE: 400,
  // Piston 呼び出し自体の失敗は「テスト失敗」と区別する（DB_DESIGN.md 3章）。
  TEST_RUN_ERROR: 502,
  PROBLEM_GENERATION_FAILED: 502,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

//** 例外を ApiError に変換する。ApplicationError はそのまま、その他は INTERNAL_ERROR 扱いにする。 */
function toApiError(error: unknown): ApiError {
  if (error instanceof ApplicationError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message };
  }
  return { code: "INTERNAL_ERROR", message: "予期しないエラーが発生しました。" };
}

/** 成功レスポンスを ApiResult<T> の形で返す。 */
export function toSuccessResponse<T>(data: T, status = 200): Response {
  const body: ApiResult<T> = { ok: true, data };
  return Response.json(body, { status });
}

/** 例外を ApiResult<never> の失敗レスポンスに変換する。握りつぶさない（CLAUDE.md）。 */
export function toErrorResponse(error: unknown): Response {
  const apiError = toApiError(error);
  const body: ApiResult<never> = { ok: false, error: apiError };
  return Response.json(body, { status: STATUS_BY_CODE[apiError.code] });
}
