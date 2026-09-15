// 担当: BE-B
// Piston API v2 のレスポンス型ガードと、実行結果 → passed / failed / error への純粋な分類。
// 純粋モジュール（"server-only" を付けない）。

import { CJ_ERROR_MARKER, CJ_SUMMARY_MARKER } from "./harness";

export interface PistonStage {
  stdout: string;
  stderr: string;
  output?: string;
  code: number | null;
  signal: string | null;
  /** 'TO'（タイムアウト）/ 'OL'（stdout 超過）/ 'EL'（stderr 超過）など。無いバージョンもある。 */
  status?: string | null;
}

export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStage;
  compile?: PistonStage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStage(value: unknown): value is PistonStage {
  if (!isRecord(value)) return false;
  const codeOk = typeof value.code === "number" || value.code === null || value.code === undefined;
  return typeof value.stdout === "string" && typeof value.stderr === "string" && codeOk;
}

/** unknown を Piston の execute レスポンスとして検証する。 */
export function isPistonExecuteResponse(value: unknown): value is PistonExecuteResponse {
  if (!isRecord(value)) return false;
  if (typeof value.language !== "string" || typeof value.version !== "string") return false;
  if (!isStage(value.run)) return false;
  if (value.compile !== undefined && !isStage(value.compile)) return false;
  return true;
}

export type PistonOutcome = "passed" | "failed" | "error";

export interface ClassifiedRun {
  outcome: PistonOutcome;
  /**
   * apply-turn.ts の `exitCode === null ? "error" : exitCode === 0 ? "passed" : "failed"` に
   * そのまま流せる値。タイムアウトは 124、出力超過（SIGKILL）は 137 を合成する。
   */
  exitCode: number | null;
  /** outcome === "error" のときの理由。 */
  errorMessage: string | null;
  /** stderr に追記してプレイヤーへ伝える補足。 */
  stderrNote: string | null;
}

function findMarkerLine(stdout: string, marker: string): string | undefined {
  return stdout.split("\n").find((line) => line.startsWith(marker));
}

/**
 * Piston の実行結果を分類する。
 * 「Piston がジョブを実行したうえでの結果」だけを扱い、呼び出し自体の失敗は PistonError（throw）が担う。
 */
export function classifyPistonRun(response: PistonExecuteResponse, expectedOutput?: string): ClassifiedRun {
  const { run, compile } = response;

  if (compile && typeof compile.code === "number" && compile.code !== 0) {
    return { outcome: "failed", exitCode: compile.code, errorMessage: null, stderrNote: "コンパイルに失敗しました。" };
  }

  if (typeof run.code === "number") {
    if (run.code !== 0) {
      return { outcome: "failed", exitCode: run.code, errorMessage: null, stderrNote: null };
    }
    if (expectedOutput !== undefined) {
      const actual = run.stdout.replace(/\r\n/g, "\n");
      const expected = expectedOutput.replace(/\r\n/g, "\n");
      return actual === expected
        ? { outcome: "passed", exitCode: 0, errorMessage: null, stderrNote: null }
        : { outcome: "failed", exitCode: 1, errorMessage: null, stderrNote: "標準出力が期待値と一致しませんでした。" };
    }
    if (findMarkerLine(run.stdout, CJ_SUMMARY_MARKER) !== undefined) {
      return { outcome: "passed", exitCode: 0, errorMessage: null, stderrNote: null };
    }
    const harnessError = findMarkerLine(run.stdout, CJ_ERROR_MARKER);
    return {
      outcome: "error",
      exitCode: null,
      errorMessage: harnessError
        ? `テストハーネスの障害: ${harnessError.slice(CJ_ERROR_MARKER.length)}`
        : "実行は正常終了しましたが、テスト結果のサマリが出力されませんでした。",
      stderrNote: null,
    };
  }

  const status = run.status ?? null;
  if (status === "TO" || (status === null && run.signal === "SIGKILL")) {
    return {
      outcome: "failed",
      exitCode: 124,
      errorMessage: null,
      stderrNote: "実行時間制限を超えました（無限ループの可能性があります）。",
    };
  }
  if (status === "OL" || status === "EL") {
    return { outcome: "failed", exitCode: 137, errorMessage: null, stderrNote: "出力サイズの上限を超えました。" };
  }
  return {
    outcome: "error",
    exitCode: null,
    errorMessage: `Piston がプロセスの終了コードを返しませんでした（signal=${run.signal ?? "なし"}, status=${status ?? "なし"}）。`,
    stderrNote: null,
  };
}
