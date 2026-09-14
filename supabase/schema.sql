-- Supabase の SQL Editor で実行してください。何度流しても同じ状態になります。
-- 1マッチ完結・ホスト含め4人までの部屋制。合言葉(password)で参加します。
--
-- 注意: jenga_blocks を game_id / player_name を持つ古い形で作ってしまっている
-- 場合は、列の対応が取れないので drop table public.jenga_blocks cascade; してから
-- 流し直してください。rooms / players は下の alter で追い付きます。

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
  round int not null default 1,
  -- 全員の画面で同じ結果を出すために、最後の実行結果と講評を部屋で共有する
  last_output text,
  verdict text check (verdict in ('stable', 'wobbly', 'collapsed')),
  judge_comment text,
  created_at timestamptz not null default now()
);

-- すでに rooms がある環境に、あとから足した列と制約を追い付かせる。
-- create table if not exists は既存テーブルには何もしないので、これが無いと
-- schema.sql を流し直しても round 列は増えず、phase の check も
-- 'generating' を知らないままになる（開始した瞬間に制約違反で落ちる）。
alter table public.rooms add column if not exists loser_id uuid;
alter table public.rooms add column if not exists stage_title text;
alter table public.rooms add column if not exists turn_index int not null default 0;
alter table public.rooms add column if not exists round int not null default 1;
alter table public.rooms add column if not exists last_output text;
alter table public.rooms add column if not exists verdict text;
alter table public.rooms add column if not exists judge_comment text;

-- check 制約は貼り直す（列追加と違って if not exists が使えないため）
alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms add constraint rooms_phase_check
  check (phase in ('lobby', 'generating', 'playing', 'finished'));

alter table public.rooms drop constraint if exists rooms_verdict_check;
alter table public.rooms add constraint rooms_verdict_check
  check (verdict in ('stable', 'wobbly', 'collapsed'));

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
