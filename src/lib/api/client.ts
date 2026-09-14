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
  StartGameRequest,
  StartGameResponse,
} from "@/types/api";
import * as mock from "./mock";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

function networkErrorResult<T>(error: unknown): ApiResult<T> {
  const message = error instanceof Error ? error.message : "通信エラーが発生しました。";
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}

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

async function get<TRes>(path: string): Promise<ApiResult<TRes>> {
  try {
    const res = await fetch(path);
    return (await res.json()) as ApiResult<TRes>;
  } catch (error) {
    return networkErrorResult<TRes>(error);
  }
}

export const apiClient = {
  createRoom: (req: CreateRoomRequest): Promise<ApiResult<CreateRoomResponse>> =>
    USE_MOCK ? mock.createRoom(req) : post("/api/rooms", req),

  joinRoom: (code: string, req: JoinRoomRequest): Promise<ApiResult<JoinRoomResponse>> =>
    USE_MOCK ? mock.joinRoom(code, req) : post(`/api/rooms/${code}/join`, req),

  startGame: (gameId: string, req: StartGameRequest): Promise<ApiResult<StartGameResponse>> =>
    USE_MOCK ? mock.startGame(gameId, req) : post(`/api/games/${gameId}/start`, req),

  createTurn: (gameId: string, req: CreateTurnRequest): Promise<ApiResult<CreateTurnResponse>> =>
    USE_MOCK ? mock.createTurn(gameId, req) : post(`/api/games/${gameId}/turns`, req),

  getGame: (gameId: string): Promise<ApiResult<GetGameResponse>> =>
    USE_MOCK ? mock.getGame(gameId) : get(`/api/games/${gameId}`),

  createProblem: (req: CreateProblemRequest): Promise<ApiResult<CreateProblemResponse>> =>
    USE_MOCK ? mock.createProblem(req) : post("/api/problems", req),
};
