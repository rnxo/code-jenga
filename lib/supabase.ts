import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLocalFallbackClient } from './localFallback'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// 環境変数が無い場合はローカル同期モード（同一ブラウザの別タブ間で同期）で動かす
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : (createLocalFallbackClient() as unknown as SupabaseClient)
