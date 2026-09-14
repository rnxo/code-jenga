import "server-only";

import type { Game, GameFinishReason, GameStatus } from "@/types/game";
import type { Database } from "@/types/database";
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
  turnNo?: number;
  turnDeadlineAt?: string | null;
  loserId?: string | null;
  finishReason?: GameFinishReason | null;
  startedAt?: string;
  finishedAt?: string;
}

/** ゲームの現在状態を更新する。 */
export async function updateGame(gameId: string, input: UpdateGameInput): Promise<Game> {
  const update: Database["public"]["Tables"]["games"]["Update"] = {};
  if (input.status !== undefined) update.status = input.status;
  if (input.problemId !== undefined) update.problem_id = input.problemId;
  if (input.currentCode !== undefined) update.current_code = input.currentCode;
  if (input.currentLineCount !== undefined) update.current_line_count = input.currentLineCount;
  if (input.currentPlayerId !== undefined) update.current_player_id = input.currentPlayerId;
  if (input.turnNo !== undefined) update.turn_no = input.turnNo;
  if (input.turnDeadlineAt !== undefined) update.turn_deadline_at = input.turnDeadlineAt;
  if (input.loserId !== undefined) update.loser_id = input.loserId;
  if (input.finishReason !== undefined) update.finish_reason = input.finishReason;
  if (input.startedAt !== undefined) update.started_at = input.startedAt;
  if (input.finishedAt !== undefined) update.finished_at = input.finishedAt;

  const { data, error } = await createAdminClient().from("games").update(update).eq("id", gameId).select().single();
  if (error) {
    throw new Error(`ゲームの更新に失敗しました: ${error.message}`);
  }
  return data;
}
