import "server-only";

import type { Game, GameFinishReason, GameStatus, Turn, TurnDifficulty, TurnResult } from "@/types/game";
import type { Database, Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

// games テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface CreateGameInput {
  roomId: string;
  roundNo: number;
}

/** ルームに紐づくゲームを作成する。 */
export async function createGame(input: CreateGameInput): Promise<Game> {
  const { data, error } = await createAdminClient()
    .from("games")
    .insert({ room_id: input.roomId, round_no: input.roundNo })
    .select()
    .single();
  if (error) {
    throw new Error(`ゲームの作成に失敗しました: ${error.message}`);
  }
  return data;
}

/** IDからゲームを取得する。 */
export async function findGameById(gameId: string): Promise<Game | null> {
  const { data, error } = await createAdminClient().from("games").select().eq("id", gameId).maybeSingle();
  if (error) {
    throw new Error(`ゲームの取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** rooms(room_id) に紐づく最新の games 行（round_no 最大）を取得する（DB_DESIGN.md 4.3 補足）。 */
export async function findLatestGameByRoomId(roomId: string): Promise<Game | null> {
  const { data, error } = await createAdminClient()
    .from("games")
    .select()
    .eq("room_id", roomId)
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`ルームのゲーム取得に失敗しました: ${error.message}`);
  }
  return data;
}

export interface UpdateGameInput {
  status?: GameStatus;
  problemId?: string;
  currentCode?: string | null;
  currentLineCount?: number | null;
  currentPlayerId?: string | null;
  /** 現在のターンに適用中の難易度（ランダム難易度ルーレット）。手番が無い間は null。 */
  currentTurnDifficulty?: TurnDifficulty | null;
  turnNo?: number;
  /** 1手あたりの制限時間（秒）。試合開始時に確定させ、以降の手番の deadline 計算に使う。 */
  turnTimeLimitSeconds?: number;
  turnDeadlineAt?: string | null;
  loserId?: string | null;
  finishReason?: GameFinishReason | null;
  startedAt?: string;
  finishedAt?: string;
}

function toGameUpdate(input: UpdateGameInput): Database["public"]["Tables"]["games"]["Update"] {
  const update: Database["public"]["Tables"]["games"]["Update"] = {};
  if (input.status !== undefined) update.status = input.status;
  if (input.problemId !== undefined) update.problem_id = input.problemId;
  if (input.currentCode !== undefined) update.current_code = input.currentCode;
  if (input.currentLineCount !== undefined) update.current_line_count = input.currentLineCount;
  if (input.currentPlayerId !== undefined) update.current_player_id = input.currentPlayerId;
  if (input.currentTurnDifficulty !== undefined) update.current_turn_difficulty = input.currentTurnDifficulty;
  if (input.turnNo !== undefined) update.turn_no = input.turnNo;
  if (input.turnTimeLimitSeconds !== undefined) update.turn_time_limit_seconds = input.turnTimeLimitSeconds;
  if (input.turnDeadlineAt !== undefined) update.turn_deadline_at = input.turnDeadlineAt;
  if (input.loserId !== undefined) update.loser_id = input.loserId;
  if (input.finishReason !== undefined) update.finish_reason = input.finishReason;
  if (input.startedAt !== undefined) update.started_at = input.startedAt;
  if (input.finishedAt !== undefined) update.finished_at = input.finishedAt;
  return update;
}

/** ゲームの現在状態を更新する。 */
export async function updateGame(gameId: string, input: UpdateGameInput): Promise<Game> {
  const { data, error } = await createAdminClient()
    .from("games")
    .update(toGameUpdate(input))
    .eq("id", gameId)
    .select()
    .single();
  if (error) {
    throw new Error(`ゲームの更新に失敗しました: ${error.message}`);
  }
  return data;
}

export interface GameUpdateGuard {
  /** この状態のときだけ更新する。 */
  status: GameStatus;
  /** この手番番号のときだけ更新する（楽観ロック）。 */
  turnNo: number;
  /** 手番の締切がこの時刻より前のときだけ更新する（timeout 用）。 */
  deadlineBefore?: string;
}

/**
 * 条件付きでゲームを更新する。条件に合致しなければ null を返す（更新なし）。
 * timeout / leave のように「今もその手番が続いているか」を確認してから確定したい処理で使う。
 */
export async function updateGameIfCurrent(
  gameId: string,
  guard: GameUpdateGuard,
  input: UpdateGameInput,
): Promise<Game | null> {
  let query = createAdminClient()
    .from("games")
    .update(toGameUpdate(input))
    .eq("id", gameId)
    .eq("status", guard.status)
    .eq("turn_no", guard.turnNo);
  if (guard.deadlineBefore !== undefined) {
    query = query.lt("turn_deadline_at", guard.deadlineBefore);
  }
  const { data, error } = await query.select().maybeSingle();
  if (error) {
    throw new Error(`ゲームの条件付き更新に失敗しました: ${error.message}`);
  }
  return data;
}

// ---- apply_turn RPC（1手確定トランザクション） ---------------------------

export interface ApplyTurnTestRunInput {
  language: string;
  languageVersion: string;
  executedCode: string;
  status: Database["public"]["Enums"]["test_run_status"];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  totalTests: number | null;
  passedTests: number | null;
  failedTests: number | null;
  durationMs: number;
  pistonRaw: unknown;
  errorMessage: string | null;
}

export interface ApplyTurnTransactionInput {
  gameId: string;
  playerId: string;
  /** 呼び出し側が読んだ時点の games.turn_no。RPC 内で一致を検証し、二重送信を弾く。 */
  expectedTurnNo: number;
  deletedLineNo: number;
  deletedLineText: string;
  codeAfter: string;
  turnResult: TurnResult;
  nextPlayerId: string | null;
  nextTurnDifficulty: TurnDifficulty | null;
  finishReason: GameFinishReason | null;
  durationMs: number;
  testRun: ApplyTurnTestRunInput;
}

export interface ApplyTurnTransactionResult {
  turn: Turn;
  game: Game;
}

/** RPC が raise する `CODE: message` 形式の例外。呼び出し側で ApplicationError に変換する。 */
export class GameRpcError extends Error {
  readonly rpcCode: string;

  constructor(rpcCode: string, message: string) {
    super(message);
    this.name = "GameRpcError";
    this.rpcCode = rpcCode;
  }
}

function parseRpcErrorMessage(message: string): GameRpcError {
  const match = /^([A-Z_]+):\s*([\s\S]*)$/.exec(message);
  if (match) {
    return new GameRpcError(match[1], match[2]);
  }
  return new GameRpcError("INTERNAL_ERROR", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * test_runs INSERT → turns INSERT → games UPDATE（決着時は rooms UPDATE も）を
 * 1トランザクションで行う（supabase/migrations/20260915120000_apply_turn_rpc.sql）。
 */
export async function applyTurnTransaction(input: ApplyTurnTransactionInput): Promise<ApplyTurnTransactionResult> {
  const testRun: Json = {
    language: input.testRun.language,
    language_version: input.testRun.languageVersion,
    executed_code: input.testRun.executedCode,
    status: input.testRun.status,
    exit_code: input.testRun.exitCode,
    stdout: input.testRun.stdout,
    stderr: input.testRun.stderr,
    compile_output: input.testRun.compileOutput,
    total_tests: input.testRun.totalTests,
    passed_tests: input.testRun.passedTests,
    failed_tests: input.testRun.failedTests,
    duration_ms: input.testRun.durationMs,
    piston_raw: (input.testRun.pistonRaw ?? null) as Json,
    error_message: input.testRun.errorMessage,
  };
  const { data, error } = await createAdminClient().rpc("apply_turn", {
    p_game_id: input.gameId,
    p_player_id: input.playerId,
    p_expected_turn_no: input.expectedTurnNo,
    p_deleted_line_no: input.deletedLineNo,
    p_deleted_line_text: input.deletedLineText,
    p_code_after: input.codeAfter,
    p_turn_result: input.turnResult,
    p_next_player_id: input.nextPlayerId,
    p_next_turn_difficulty: input.nextTurnDifficulty,
    p_finish_reason: input.finishReason,
    p_duration_ms: input.durationMs,
    p_test_run: testRun,
  });
  if (error) {
    throw parseRpcErrorMessage(error.message);
  }
  if (!isRecord(data) || !isRecord(data.turn) || !isRecord(data.game)) {
    throw new Error("apply_turn RPC の戻り値が不正です。");
  }
  // RPC は to_jsonb(行) を返すため、列構成は Tables<"turns"> / Tables<"games"> と一致する。
  return { turn: data.turn as unknown as Turn, game: data.game as unknown as Game };
}
