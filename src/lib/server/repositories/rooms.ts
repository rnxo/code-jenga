import "server-only";

import type { Room, RoomStatus } from "@/types/game";
import { createAdminClient } from "@/lib/supabase/admin";

// rooms テーブルへのアクセスをまとめるリポジトリ。
// createAdminClient()（@/lib/supabase/admin）を使い、service role で読み書きする。
// 担当: BE-A

export interface CreateRoomInput {
  hostId: string;
  code: string;
  maxPlayers: number;
}

/** ルームを新規作成する。 */
export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const { data, error } = await createAdminClient()
    .from("rooms")
    .insert({ host_id: input.hostId, code: input.code, max_players: input.maxPlayers })
    .select()
    .single();
  if (error) {
    throw new Error(`ルームの作成に失敗しました: ${error.message}`);
  }
  return data;
}

/** 入室コードからルームを取得する。 */
export async function findRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await createAdminClient()
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) {
    throw new Error(`ルームの取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** IDからルームを取得する。 */
export async function findRoomById(roomId: string): Promise<Room | null> {
  const { data, error } = await createAdminClient().from("rooms").select().eq("id", roomId).maybeSingle();
  if (error) {
    throw new Error(`ルームの取得に失敗しました: ${error.message}`);
  }
  return data;
}

/** ルームの状態を更新する。 */
export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  const { error } = await createAdminClient().from("rooms").update({ status }).eq("id", roomId);
  if (error) {
    throw new Error(`ルーム状態の更新に失敗しました: ${error.message}`);
  }
}

/**
 * ホスト権限を別のプレイヤーへ移す。
 * 現在のホストが expectedHostId と一致するときだけ更新し（同時離脱の競合対策）、更新できたら true を返す。
 */
export async function transferRoomHost(
  roomId: string,
  expectedHostId: string,
  nextHostId: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("rooms")
    .update({ host_id: nextHostId })
    .eq("id", roomId)
    .eq("host_id", expectedHostId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`ホスト権限の委譲に失敗しました: ${error.message}`);
  }
  return data !== null;
}
