// ブラウザ（Client Component）用 Supabase クライアント。
// publishable key のみを使用する（service role キーはここに絶対に持ち込まない）。

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

function readEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.local を確認してください。`);
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}
