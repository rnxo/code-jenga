// ============================================================================
// フロント⇔バックの API 契約（唯一の共有スキーマ）
//
// DB_DESIGN.md 5章「ゲーム進行と DB 操作の対応」に1対1で対応させている。
// このファイルの変更はチーム全員の合意の上で行うこと（担当ゾーン表: 共有）。
//
// - Route Handler（src/app/api/**）はここの *Request / *Response 型を実装する
// - フロントは src/lib/api/client.ts 経由でのみこれらの型を利用する
// - 成功/失敗は ApiResult<T> の判別共用体で表現し、握りつぶさない（CLAUDE.md）
// ============================================================================

import type {
  CodeLanguage,
  Game,
  GamePlayer,
  Problem,
  Room,
  Turn,
} from "./game";

// ---- 共通のレスポンス形式 -----------------------------------------------

export type ApiErrorCode =
  | "NOT_YOUR_TURN"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_CLOSED"
  | "GAME_NOT_READY"
  | "GAME_NOT_FOUND"
  | "GAME_NOT_PLAYING"
  | "INVALID_LINE"
  | "LINE_NOT_DELETABLE"
  | "TEST_RUN_ERROR"
  | "PROBLEM_GENERATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

// ---- POST /api/rooms（ルーム作成） --------------------------------------

export interface CreateRoomRequest {
  /** ホストの表示名（未指定ならプロフィールの nickname を使用） */
  nickname?: string;
  maxPlayers?: number;
}

export interface CreateRoomResponse {
  room: Room;
  game: Game;
}

// ---- POST /api/rooms/[code]/join（入室） --------------------------------

export interface JoinRoomRequest {
  nickname?: string;
}

export interface JoinRoomResponse {
  /** join_room RPC が返す games.id */
  gameId: string;
}

// ---- PATCH /api/games/[gameId]/language（ロビーでの実行言語変更） -----------

export interface UpdateGameLanguageRequest {
  language: CodeLanguage;
}

export interface UpdateGameLanguageResponse {
  game: Game;
}

// ---- POST /api/games/[gameId]/start（試合開始） -------------------------

export interface StartGameRequest {
  turnTimeLimitSeconds?: number;
}

export interface StartGameResponse {
  game: Game;
}

// ---- POST /api/games/[gameId]/turns（1手確定） --------------------------

export interface CreateTurnRequest {
  /** 削除前コードにおける削除行番号（1始まり） */
  lineNo: number;
}

export interface CreateTurnResponse {
  turn: Turn;
  game: Game;
}

// ---- GET /api/games/[gameId]（状態取得） --------------------------------

export interface GetGameResponse {
  game: Game;
  players: GamePlayer[];
  turns: Turn[];
}

// ---- POST /api/games/[gameId]/timeout（制限時間切れの確定） ---------------

/** リクエストボディは不要。参加者なら誰が叩いてもよく、サーバーが turn_deadline_at を検証する。 */
export interface TimeoutTurnResponse {
  game: Game;
  /** この呼び出しで試合を終了させたか。false なら既に手が確定していた／別の呼び出しで終了済み。 */
  applied: boolean;
}

// ---- POST /api/games/[gameId]/leave（離脱） ------------------------------

/** リクエストボディは不要（離脱者は認証ユーザー自身）。 */
export interface LeaveGameResponse {
  game: Game;
}

// ---- POST /api/games/[gameId]/rematch（再戦） ----------------------------

/** リクエストボディは不要。決着済みの前局の gameId を指定する。 */
export interface RematchGameResponse {
  /** 新しく作られた（または既に存在した）次局。status = 'waiting' */
  game: Game;
  players: GamePlayer[];
}

// ---- POST /api/problems（お題生成＋Piston事前検証） ----------------------

export interface CreateProblemRequest {
  difficulty?: string;
}

export interface CreateProblemResponse {
  problem: Problem;
}
