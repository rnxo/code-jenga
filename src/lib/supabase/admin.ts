// service role キーを使う Supabase クライアント（RLS をバイパスする）。
// DB_DESIGN.md の設計方針どおり、games / turns / test_runs 等への書き込みは
// 必ずこのクライアント経由で Route Handler からのみ行うこと。
//
// "server-only" により、誤ってクライアントバンドルに import された場合は
// ビルド時にエラーとなる（service role キーの漏洩を構造的に防ぐ）。
import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function readEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.local を確認してください。`);
  }
  return value;
}

let cachedClient: SupabaseClient<Database> | null = null;

/** service role キーで初期化した Supabase クライアントを返す（RLS を無視する）。 */
export function createAdminClient(): SupabaseClient<Database> {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createSupabaseClient<Database>(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return cachedClient;
}
