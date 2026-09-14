import "server-only";

import { ApplicationError } from "@/lib/api/errors";
import { createClient } from "@/lib/supabase/server";

/** 現在のSupabaseセッションから認証済みユーザーIDを取得する。 */
export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApplicationError("UNAUTHENTICATED", "認証が必要です。");
  }
  return data.user.id;
}