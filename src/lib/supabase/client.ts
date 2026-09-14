// ブラウザ（Client Component）用 Supabase クライアント。
// publishable key のみを使用する（service role キーはここに絶対に持ち込まない）。

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Next.js が NEXT_PUBLIC_* をブラウザ用バンドルへ埋め込めるのは
// `process.env.NEXT_PUBLIC_XXX` という静的なドット参照だけ。
// `process.env[name]` のような動的アクセスは置換されず、ブラウザでは常に undefined になる。
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.local を確認してください。`);
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );
}
