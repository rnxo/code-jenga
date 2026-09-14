import "server-only";

import type { Room, RoomStatus } from "@/types/game";

// rooms テーブルへのアクセスをまとめるリポジトリ。
// createAdminClient()（@/lib/supabase/admin）を使い、service role で読み書きする。
// 担当: BE-A

export interface CreateRoomInput {
  hostId: string;
  code: string;
  maxPlayers: number;
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  throw new Error(`未実装: createRoom(${JSON.stringify(input)})`);
}

export async function findRoomByCode(code: string): Promise<Room | null> {
  throw new Error(`未実装: findRoomByCode(${code})`);
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  throw new Error(`未実装: updateRoomStatus(${roomId}, ${status})`);
}
