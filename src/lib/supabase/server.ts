// Server Component / Route Handler 用 Supabase クライアント（cookie 経由でセッションを引き継ぐ）。
// publishable key のみを使用する。書き込み権限が必要な処理は admin.ts を使うこと。

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

function readEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.local を確認してください。`);
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component から呼ばれた場合、cookie の set は失敗する。
            // セッションの更新は proxy.ts 側で行っているため、ここでは無視してよい。
          }
        },
      },
    },
  );
}
