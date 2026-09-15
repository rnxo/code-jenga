// 担当: BE-B
// Piston 呼び出し「自体」の失敗を表す例外。
// テストが落ちた（failed）のとは別物で、呼び出し側は test_run_status='error'（判定不能）として扱う
// （DB_DESIGN.md 3章の補足、judge.ts のコメント参照）。
// 純粋モジュール（"server-only" を付けない）: Vitest から import できるようにするため。

export type PistonFailureKind =
  | "network" // fetch 自体が失敗（DNS・接続拒否）
  | "timeout" // クライアント側 AbortSignal によるタイムアウト
  | "unauthorized" // 401 / 403（公開インスタンスのホワイトリスト制など）
  | "rate_limited" // 429
  | "bad_request" // 400 / 415（送信内容・ランタイム指定の誤り）
  | "server_error" // 5xx
  | "malformed_response"; // 2xx だがレスポンスの形が読めない

export class PistonError extends Error {
  readonly kind: PistonFailureKind;
  readonly status: number | undefined;

  constructor(kind: PistonFailureKind, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "PistonError";
    this.kind = kind;
    this.status = options?.status;
  }

  /** 一過性の失敗（再送しても安全で、成功する見込みがある）か。 */
  get retryable(): boolean {
    return (
      this.kind === "network" || this.kind === "timeout" || this.kind === "rate_limited" || this.kind === "server_error"
    );
  }
}
