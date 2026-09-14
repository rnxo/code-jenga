import "server-only";

import { getServerEnv } from "@/lib/server/env";
import { classifyPistonRun, isPistonExecuteResponse } from "./classify";
import { composeFromConcatenated, composeProgram } from "./compose";
import { PistonError } from "./errors";

// 担当: BE-B
// Piston API を呼び出してコードを隔離実行する。
// ネットワークエラー・レート制限・コンパイラクラッシュなど Piston 呼び出し自体の失敗は
// テスト失敗（failed）とは区別し、PistonError を throw する。呼び出し側は test_run_status='error'
// として扱うこと（DB_DESIGN.md 3章の補足）。
//
// 実行の流れ: compose.ts で Vitest 互換ハーネス付きの1ファイルに合成 → POST {PISTON_API_URL}/execute
// → classify.ts で passed / failed / error に分類。

export interface PistonRunInput {
  language: string;
  languageVersion: string;
  /** 対象コード＋テストコードを結合したソース全文（sourceCode / testCode があればそちらを優先） */
  code: string;
  /** 分けて渡せる場合はこちらを優先する（合成の精度が上がる）。 */
  sourceCode?: string;
  testCode?: string;
}

export interface PistonRunResult {
  /** null は「Piston は実行したが判定不能」（ハーネス障害など）。呼び出し不能は throw で表す。 */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  raw: unknown;
  /** 実際に Piston へ送信したソース全文 */
  executedCode: string;
  /** 実際に使われた言語・バージョン（レスポンスの値） */
  resolvedLanguage: string;
  resolvedVersion: string;
  /** exitCode === null のときの理由 */
  errorMessage: string | null;
}

const REQUEST_TIMEOUT_MS = 10_000;
const TOTAL_BUDGET_MS = 20_000;
const RETRY_DELAYS_MS = [300, 900] as const;
const MAX_ERROR_BODY_CHARS = 500;

interface PistonConfig {
  executeUrl: string;
  language: string;
  version: string;
}

/** 環境変数から Piston 設定を解決する。languageVersion の "latest" は Piston では無効なので "*" に正規化する。 */
function resolveConfig(input: PistonRunInput): PistonConfig {
  const { PISTON_API_URL } = getServerEnv();
  const base = PISTON_API_URL.replace(/\/+$/, "").replace(/\/execute$/, "");
  const language = process.env.PISTON_LANGUAGE?.trim() || (input.language === "typescript" ? "deno" : input.language);
  const requested = input.languageVersion.trim();
  const version =
    process.env.PISTON_LANGUAGE_VERSION?.trim() || (requested === "" || requested === "latest" ? "*" : requested);
  return { executeUrl: `${base}/execute`, language, version };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPistonError(error: unknown, executeUrl: string): PistonError {
  if (error instanceof PistonError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new PistonError("timeout", `Piston の応答が ${REQUEST_TIMEOUT_MS}ms 以内に返りませんでした（${executeUrl}）。`, {
      cause: error,
    });
  }
  return new PistonError(
    "network",
    `Piston へ接続できません（${executeUrl}）。piston/docker-compose.yml のコンテナが起動しているか確認してください。`,
    { cause: error },
  );
}

async function httpErrorToPistonError(response: Response, config: PistonConfig): Promise<PistonError> {
  const body = (await response.text().catch(() => "")).slice(0, MAX_ERROR_BODY_CHARS);
  const { status } = response;
  if (status === 401 || status === 403) {
    return new PistonError(
      "unauthorized",
      `Piston が認証を要求しています（HTTP ${status}）。公開インスタンス emkc.org は 2026/2/15 からホワイトリスト制です。piston/docker-compose.yml でセルフホストしたものを PISTON_API_URL に設定してください。: ${body}`,
      { status },
    );
  }
  if (status === 429) {
    return new PistonError("rate_limited", `Piston のレート制限に達しました（HTTP 429）: ${body}`, { status });
  }
  if (status >= 500) {
    return new PistonError("server_error", `Piston がサーバーエラーを返しました（HTTP ${status}）: ${body}`, { status });
  }
  return new PistonError(
    "bad_request",
    `Piston がリクエストを拒否しました（HTTP ${status}）。PISTON_LANGUAGE=${config.language} / PISTON_LANGUAGE_VERSION=${config.version} がインストール済みか確認してください（GET ${config.executeUrl.replace(/\/execute$/, "/runtimes")}）: ${body}`,
    { status },
  );
}

async function executeOnce(config: PistonConfig, program: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(config.executeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [{ name: "main.ts", content: program }],
        stdin: "",
        args: [],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw toPistonError(error, config.executeUrl);
  }
  if (!response.ok) {
    throw await httpErrorToPistonError(response, config);
  }
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new PistonError("malformed_response", "Piston の応答を JSON として解釈できませんでした。", { cause: error });
  }
}

/** 一過性の失敗に限り、総予算の範囲内で再試行する。 */
async function executeWithRetry(config: PistonConfig, program: string): Promise<unknown> {
  const startedAt = Date.now();
  let attempt = 0;
  for (;;) {
    try {
      return await executeOnce(config, program);
    } catch (error) {
      const pistonError = toPistonError(error, config.executeUrl);
      const delay = RETRY_DELAYS_MS[attempt];
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (!pistonError.retryable || delay === undefined || remaining < delay + REQUEST_TIMEOUT_MS) {
        throw pistonError;
      }
      attempt += 1;
      await sleep(delay);
    }
  }
}

export async function runOnPiston(input: PistonRunInput): Promise<PistonRunResult> {
  const config = resolveConfig(input);
  const composed =
    input.sourceCode !== undefined && input.testCode !== undefined
      ? composeProgram({ sourceCode: input.sourceCode, testCode: input.testCode })
      : composeFromConcatenated(input.code);

  const raw = await executeWithRetry(config, composed.program);
  if (!isPistonExecuteResponse(raw)) {
    throw new PistonError("malformed_response", "Piston の応答に run ステージが含まれていません。");
  }

  const classified = classifyPistonRun(raw);
  const compileFailed = raw.compile !== undefined && typeof raw.compile.code === "number" && raw.compile.code !== 0;
  const stderr = classified.stderrNote ? `${raw.run.stderr}\n${classified.stderrNote}`.trim() : raw.run.stderr;
  return {
    exitCode: classified.exitCode,
    stdout: raw.run.stdout,
    stderr,
    compileOutput: compileFailed && raw.compile ? raw.compile.stderr || raw.compile.output || null : null,
    raw,
    executedCode: composed.program,
    resolvedLanguage: raw.language,
    resolvedVersion: raw.version,
    errorMessage: classified.errorMessage,
  };
}
