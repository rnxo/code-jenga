import "server-only";

import type { Game, GameFinishReason, GameStatus } from "@/types/game";

// games テーブルへのアクセスをまとめるリポジトリ。担当: BE-A

export interface CreateGameInput {
  roomId: string;
  roundNo: number;
}

export async function createGame(input: CreateGameInput): Promise<Game> {
  throw new Error(`未実装: createGame(${JSON.stringify(input)})`);
}

export async function findGameById(gameId: string): Promise<Game | null> {
  throw new Error(`未実装: findGameById(${gameId})`);
}

/** rooms(room_id) に紐づく最新の games 行（round_no 最大）を取得する（DB_DESIGN.md 4.3 補足）。 */
export async function findLatestGameByRoomId(roomId: string): Promise<Game | null> {
  throw new Error(`未実装: findLatestGameByRoomId(${roomId})`);
}

export interface UpdateGameInput {
  status?: GameStatus;
  problemId?: string;
  currentCode?: string | null;
  currentLineCount?: number | null;
  currentPlayerId?: string | null;
  turnNo?: number;
  turnDeadlineAt?: string | null;
  loserId?: string | null;
  finishReason?: GameFinishReason | null;
  startedAt?: string;
  finishedAt?: string;
}

export async function updateGame(gameId: string, input: UpdateGameInput): Promise<Game> {
  throw new Error(`未実装: updateGame(${gameId}, ${JSON.stringify(input)})`);
}
