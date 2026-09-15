// フロントエンドから Route Handler を呼び出す唯一の窓口。
// NEXT_PUBLIC_USE_MOCK_API=true のときはバックエンド実装を待たずに
// src/lib/api/mock.ts のレスポンスを返す。
//
// features/* からは必ずこの apiClient 経由で通信すること
// （fetch を直接呼ばない）。

import type {
  ApiResult,
  CreateProblemRequest,
  CreateProblemResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  CreateTurnRequest,
  CreateTurnResponse,
  GetGameResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  LeaveGameResponse,
  RematchGameResponse,
  StartGameRequest,
  StartGameResponse,
  TimeoutTurnResponse,
  UpdateGameLanguageRequest,
  UpdateGameLanguageResponse,
} from "@/types/api";
import * as mock from "./mock";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

// 通信エラーが発生した場合の ApiResult を返す。
function networkErrorResult<T>(error: unknown): ApiResult<T> {
  const message = error instanceof Error ? error.message : "通信エラーが発生しました。";
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}

// POST リクエストを送信する。失敗した場合は networkErrorResult を返す。
async function post<TReq, TRes>(path: string, body: TReq): Promise<ApiResult<TRes>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult<TRes>;
  } catch (error) {
    return networkErrorResult<TRes>(error);
  }
}

// PATCH リクエストを送信する。失敗した場合は networkErrorResult を返す。
async function patch<TReq, TRes>(path: string, body: TReq): Promise<ApiResult<TRes>> {
  try {
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult<TRes>;
  } catch (error) {
    return networkErrorResult<TRes>(error);
  }
}

// GET リクエストを送信する。失敗した場合は networkErrorResult を返す。
async function get<TRes>(path: string): Promise<ApiResult<TRes>> {
  try {
    const res = await fetch(path);
    return (await res.json()) as ApiResult<TRes>;
  } catch (error) {
    return networkErrorResult<TRes>(error);
  }
}

export const apiClient = {
  // ルーム作成 / 入室 / 試合開始 / ターン作成 / 試合情報取得 / お題作成
  // NEXT_PUBLIC_USE_MOCK_API=true のときは mock.ts の実装を呼ぶ。
  createRoom: (req: CreateRoomRequest): Promise<ApiResult<CreateRoomResponse>> =>
    USE_MOCK ? mock.createRoom(req) : post("/api/rooms", req),

  joinRoom: (code: string, req: JoinRoomRequest): Promise<ApiResult<JoinRoomResponse>> =>
    USE_MOCK ? mock.joinRoom(code, req) : post(`/api/rooms/${code}/join`, req),

  updateGameLanguage: (
    gameId: string,
    req: UpdateGameLanguageRequest,
  ): Promise<ApiResult<UpdateGameLanguageResponse>> =>
    USE_MOCK ? mock.updateGameLanguage(gameId, req) : patch(`/api/games/${gameId}/language`, req),

  startGame: (gameId: string, req: StartGameRequest): Promise<ApiResult<StartGameResponse>> =>
    USE_MOCK ? mock.startGame(gameId, req) : post(`/api/games/${gameId}/start`, req),

  createTurn: (gameId: string, req: CreateTurnRequest): Promise<ApiResult<CreateTurnResponse>> =>
    USE_MOCK ? mock.createTurn(gameId, req) : post(`/api/games/${gameId}/turns`, req),

  getGame: (gameId: string): Promise<ApiResult<GetGameResponse>> =>
    USE_MOCK ? mock.getGame(gameId) : get(`/api/games/${gameId}`),

  timeoutTurn: (gameId: string): Promise<ApiResult<TimeoutTurnResponse>> =>
    USE_MOCK ? mock.timeoutTurn(gameId) : post(`/api/games/${gameId}/timeout`, {}),

  leaveGame: (gameId: string): Promise<ApiResult<LeaveGameResponse>> =>
    USE_MOCK ? mock.leaveGame(gameId) : post(`/api/games/${gameId}/leave`, {}),

  rematchGame: (gameId: string): Promise<ApiResult<RematchGameResponse>> =>
    USE_MOCK ? mock.rematchGame(gameId) : post(`/api/games/${gameId}/rematch`, {}),

  createProblem: (req: CreateProblemRequest): Promise<ApiResult<CreateProblemResponse>> =>
    USE_MOCK ? mock.createProblem(req) : post("/api/problems", req),
};
