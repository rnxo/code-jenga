import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLocalFallbackClient } from "./localFallback";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// README は PUBLISHABLE_KEY、Supabase の古い文書は ANON_KEY と呼ぶ。どちらでも動かす
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

// 鍵が無い場合はローカル同期モード（同一ブラウザの別タブ間で同期）で動かす
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string)
  : (createLocalFallbackClient() as unknown as SupabaseClient);
