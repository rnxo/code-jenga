import "server-only";

import { getServerEnv } from "@/lib/server/env";
import { classifyPistonRun, isPistonExecuteResponse, type PistonOutcome } from "./classify";
import { PistonError } from "./errors";
import {
  resolveLanguage,
  resolvePistonLanguageOverride,
  resolvePistonVersionOverride,
  type LanguageDefinition,
} from "./languages";

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
  /**
   * passed / failed / error の分類結果（classify.ts）。test_runs.status にそのまま入れられる。
   * 呼び出し側は exitCode から再判定せず、この値を使うこと（backend-todo 4-3）。
   */
  outcome: PistonOutcome;
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

// Piston 側のジョブ制限（backend-todo 4-1）。
// piston/docker-compose.yml の PISTON_RUN_TIMEOUT / PISTON_COMPILE_TIMEOUT が上限で、
// リクエストの run_timeout / compile_timeout はそれ以下でなければ Piston が 400 を返す。
const DEFAULT_RUN_TIMEOUT_MS = 3_000;
const DEFAULT_COMPILE_TIMEOUT_MS = 10_000;
// HTTP 1回あたりの待ち時間。Piston の実行上限（compile + run）にキュー待ち・転送分の余裕を足す。
const REQUEST_TIMEOUT_MARGIN_MS = 5_000;
const MIN_REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [300, 900] as const;
const MAX_ERROR_BODY_CHARS = 500;

// 公開時（piston/docker-compose.public.yml）に前段の Caddy が要求する共有キーのヘッダー名。
const API_KEY_HEADER = "X-Piston-Key";

interface PistonConfig {
  executeUrl: string;
  /** 未設定（ローカル直結）なら undefined。設定時は X-Piston-Key ヘッダーで送る。 */
  apiKey: string | undefined;
  language: string;
  version: string;
  /** Piston へ送る files[0].name。言語ごとに拡張子が違う（main.ts / main.py） */
  fileName: string;
  /** Piston に渡す run ステージの制限時間（ms） */
  runTimeoutMs: number;
  /** Piston に渡す compile ステージの制限時間（ms） */
  compileTimeoutMs: number;
  /** クライアント側（fetch）の1リクエストのタイムアウト（ms） */
  requestTimeoutMs: number;
  /** リトライを含めた総予算（ms） */
  totalBudgetMs: number;
}

/** 環境変数から正の整数（ms）を読む。未設定・不正値は既定値を使い、不正値は警告を出す。 */
function readTimeoutEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    console.warn(`[piston] ${name}="${raw}" は正の整数ではないため既定値 ${fallback} を使います。`);
    return fallback;
  }
  return value;
}

/**
 * 言語定義と環境変数から Piston 設定を解決する。
 * languageVersion の "latest" は Piston では無効なので言語ごとの既定値（多くは "*"）に正規化する。
 */
function resolveConfig(definition: LanguageDefinition, input: PistonRunInput): PistonConfig {
  const { PISTON_API_URL } = getServerEnv();
  const base = PISTON_API_URL.replace(/\/+$/, "").replace(/\/execute$/, "");
  const language = resolvePistonLanguageOverride(definition) ?? definition.pistonLanguage;
  const requested = input.languageVersion.trim();
  const version =
    resolvePistonVersionOverride(definition) ??
    (requested === "" || requested === "latest" ? definition.defaultVersion : requested);
  const runTimeoutMs = readTimeoutEnv("PISTON_RUN_TIMEOUT_MS", DEFAULT_RUN_TIMEOUT_MS);
  const compileTimeoutMs = readTimeoutEnv("PISTON_COMPILE_TIMEOUT_MS", DEFAULT_COMPILE_TIMEOUT_MS);
  const requestTimeoutMs = Math.max(MIN_REQUEST_TIMEOUT_MS, runTimeoutMs + compileTimeoutMs + REQUEST_TIMEOUT_MARGIN_MS);
  return {
    executeUrl: `${base}/execute`,
    apiKey: process.env.PISTON_API_KEY?.trim() || undefined,
    language,
    version,
    fileName: definition.fileName,
    runTimeoutMs,
    compileTimeoutMs,
    requestTimeoutMs,
    totalBudgetMs: requestTimeoutMs * 2,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPistonError(error: unknown, config: PistonConfig): PistonError {
  if (error instanceof PistonError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new PistonError(
      "timeout",
      `Piston の応答が ${config.requestTimeoutMs}ms 以内に返りませんでした（${config.executeUrl}）。同時実行が多くキューイングされている可能性があります。`,
      { cause: error },
    );
  }
  return new PistonError(
    "network",
    `Piston へ接続できません（${config.executeUrl}）。piston/docker-compose.yml のコンテナが起動しているか確認してください（scripts/setup-piston.sh）。`,
    { cause: error },
  );
}

async function httpErrorToPistonError(response: Response, config: PistonConfig): Promise<PistonError> {
  const body = (await response.text().catch(() => "")).slice(0, MAX_ERROR_BODY_CHARS);
  const { status } = response;
  if (status === 401 || status === 403) {
    const hint = config.apiKey
      ? `PISTON_API_KEY が Piston 側（piston/docker-compose.public.yml に渡した PISTON_API_KEY）と一致しているか確認してください。`
      : `PISTON_API_KEY が未設定です。公開版（piston/docker-compose.public.yml）を使う場合は同じキーを設定してください。公開インスタンス emkc.org は 2026/2/15 からホワイトリスト制のため使えません。`;
    return new PistonError("unauthorized", `Piston が認証を要求しています（HTTP ${status}）。${hint}: ${body}`, {
      status,
    });
  }
  if (status === 429) {
    return new PistonError("rate_limited", `Piston のレート制限に達しました（HTTP 429）: ${body}`, { status });
  }
  if (status >= 500) {
    return new PistonError("server_error", `Piston がサーバーエラーを返しました（HTTP ${status}）: ${body}`, { status });
  }
  return new PistonError(
    "bad_request",
    `Piston がリクエストを拒否しました（HTTP ${status}）。ランタイム ${config.language}（バージョン ${config.version}）がインストール済みか（GET ${config.executeUrl.replace(/\/execute$/, "/runtimes")}、未導入なら scripts/setup-piston.sh）、run_timeout=${config.runTimeoutMs} / compile_timeout=${config.compileTimeoutMs} が docker-compose.yml の PISTON_RUN_TIMEOUT / PISTON_COMPILE_TIMEOUT 以下かを確認してください: ${body}`,
    { status },
  );
}

async function executeOnce(config: PistonConfig, program: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(config.executeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { [API_KEY_HEADER]: config.apiKey } : {}),
      },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [{ name: config.fileName, content: program }],
        stdin: "",
        args: [],
        // backend-todo 4-1: Piston 既定（run 3秒・compile 10秒）に任せず明示する。
        run_timeout: config.runTimeoutMs,
        compile_timeout: config.compileTimeoutMs,
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw toPistonError(error, config);
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
      const pistonError = toPistonError(error, config);
      const delay = RETRY_DELAYS_MS[attempt];
      const remaining = config.totalBudgetMs - (Date.now() - startedAt);
      if (!pistonError.retryable || delay === undefined || remaining < delay + config.requestTimeoutMs) {
        throw pistonError;
      }
      attempt += 1;
      await sleep(delay);
    }
  }
}

export async function runOnPiston(input: PistonRunInput): Promise<PistonRunResult> {
  // 未対応言語はここで throw される。呼び出し側は PistonError と同じく TEST_RUN_ERROR として扱えばよい。
  const definition = resolveLanguage(input.language);
  const config = resolveConfig(definition, input);
  // 連結済みの code しか無い場合も、除去は行単位なので sourceCode にまとめて渡せば同じ結果になる。
  const composed =
    input.sourceCode !== undefined && input.testCode !== undefined
      ? definition.compose({ sourceCode: input.sourceCode, testCode: input.testCode })
      : definition.compose({ sourceCode: input.code, testCode: "" });

  const raw = await executeWithRetry(config, composed.program);
  if (!isPistonExecuteResponse(raw)) {
    throw new PistonError("malformed_response", "Piston の応答に run ステージが含まれていません。");
  }

  const classified = classifyPistonRun(raw, definition.testStrategy === "stdout" ? (input.testCode ?? "") : undefined);
  const compileFailed = raw.compile !== undefined && typeof raw.compile.code === "number" && raw.compile.code !== 0;
  const stderr = classified.stderrNote ? `${raw.run.stderr}\n${classified.stderrNote}`.trim() : raw.run.stderr;
  return {
    outcome: classified.outcome,
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
