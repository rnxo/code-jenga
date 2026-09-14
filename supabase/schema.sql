-- Supabase の SQL Editor で実行してください。
-- 1マッチ完結・ホスト含め4人までの部屋制。合言葉(password)で参加します。

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  password text not null,
  host_id uuid not null,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'generating', 'playing', 'finished')),
  loser_id uuid,
  -- Gemini が付けた舞台の名前と、何手目か
  stage_title text,
  turn_index int not null default 0,
  -- 全員の画面で同じ結果を出すために、最後の実行結果と講評を部屋で共有する
  last_output text,
  verdict text check (verdict in ('stable', 'wobbly', 'collapsed')),
  judge_comment text,
  created_at timestamptz not null default now()
);

-- 同じ合言葉で待機中の部屋が複数できないようにする
create unique index if not exists rooms_active_password_idx
  on public.rooms (password)
  where phase <> 'finished';

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists players_room_idx on public.players (room_id, created_at);

create table if not exists public.jenga_blocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  block_index int not null,
  code_snippet text not null,
  created_at timestamptz not null default now()
);

create index if not exists jenga_blocks_room_idx on public.jenga_blocks (room_id, block_index);

-- ハッカソン用の割り切り：匿名ユーザーに全操作を許可する。
-- password は秘匿情報ではなく単なる合言葉として扱うこと（anon から読めます）。
-- 本番運用するなら Supabase Auth を入れて RLS を絞ってください。
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.jenga_blocks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rooms', 'players', 'jenga_blocks'] loop
    execute format('drop policy if exists "anon all" on public.%I', t);
    execute format(
      'create policy "anon all" on public.%I for all to anon using (true) with check (true)', t
    );
  end loop;
end $$;

-- Realtime の配信対象に追加
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.jenga_blocks;
