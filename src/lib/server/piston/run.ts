import "server-only";

// 担当: BE-B
// Piston API を呼び出してコードを隔離実行する。
// ネットワークエラー・レート制限・コンパイラクラッシュなど Piston 呼び出し自体の失敗は
// テスト失敗（failed）とは区別し、呼び出し側で test_run_status='error' として扱うこと
// （DB_DESIGN.md 3章の補足）。

export interface PistonRunInput {
  language: string;
  languageVersion: string;
  /** 対象コード＋テストコードを結合したソース全文 */
  code: string;
}

export interface PistonRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  raw: unknown;
}

export async function runOnPiston(input: PistonRunInput): Promise<PistonRunResult> {
  throw new Error(`未実装: runOnPiston(${JSON.stringify(input)})`);
}
