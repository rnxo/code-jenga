// ============================================================================
// ドメイン型（DB_DESIGN.md の ENUM 定義に対応）
//
// database.ts（自動生成）の Enums をそのまま再エクスポートする。
// アプリコード側では database.ts を直接参照せず、必ずこのファイル経由で
// ENUM 型を扱うこと（文字列リテラルの直書き・any は禁止 / CLAUDE.md）。
// ============================================================================

import type { Enums, Tables } from "./database";

// ---- ENUM 型 ----------------------------------------------------------

/** お題の生成元 */
export type ProblemSource = Enums<"problem_source">;

/** ルームの状態 */
export type RoomStatus = Enums<"room_status">;

/** 試合の状態 */
export type GameStatus = Enums<"game_status">;

/** 1手の判定結果 */
export type TurnResult = Enums<"turn_result">;

/** テスト実行の目的 */
export type TestRunKind = Enums<"test_run_kind">;

/** テスト実行そのものの結果（DB_DESIGN.md 3章: error は「判定不能」であり turn_result の out とは別物） */
export type TestRunStatus = Enums<"test_run_status">;

/** 試合が終了した理由 */
export type GameFinishReason = Enums<"game_finish_reason">;

/**
 * 1手ごとにルーレットで決まる難易度（削除してよい行の縛り）。
 * problems.difficulty（お題自体の難易度ラベル、text の自由記述）とは別概念。
 */
export type TurnDifficulty = Enums<"turn_difficulty">;

/**
 * 試合で使う実行言語（ロビーでホストが選択する）。
 * problems.language（お題が書かれている言語、text）や test_runs.language（実際に走ったランタイム名）とは別概念。
 */
export type CodeLanguage = Enums<"code_language">;

// ---- テーブル行の型エイリアス ------------------------------------------

export type Profile = Tables<"profiles">;
export type Room = Tables<"rooms">;
export type Game = Tables<"games">;
export type GamePlayer = Tables<"game_players">;
export type Problem = Tables<"problems">;
export type TestRun = Tables<"test_runs">;
/** 参加者に公開する test_runs の列だけを持つ View の行（executed_code / piston_raw / stdout は含まない）。 */
export type TestRunSummary = Tables<"test_run_summaries">;
export type Turn = Tables<"turns">;
