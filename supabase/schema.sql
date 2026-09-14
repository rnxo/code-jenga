-- Supabase を使う場合、SQL Editor で実行してください
create table if not exists public.jenga_blocks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null default '00000000-0000-0000-0000-000000000000',
  block_index int not null,
  code_snippet text not null,
  player_name text not null default 'Anonymous',
  created_at timestamptz not null default now()
);

alter table public.jenga_blocks enable row level security;

-- デモ用：匿名ユーザーに全操作を許可（本番では必ず絞ること）
create policy "anon can read"   on public.jenga_blocks for select to anon using (true);
create policy "anon can insert" on public.jenga_blocks for insert to anon with check (true);
create policy "anon can delete" on public.jenga_blocks for delete to anon using (true);

-- Realtime の配信対象に追加
alter publication supabase_realtime add table public.jenga_blocks;
