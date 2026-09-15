import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** 認証ユーザー自身の表示名を更新する。入力の形式検証は Route Handler で行う。 */
export async function updateNickname(userId: string, nickname: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ nickname, is_anonymous: false })
    .eq("id", userId);
  if (error) {
    throw new Error(`プロフィールの更新に失敗しました: ${error.message}`);
  }
}