-- ============================================================
-- 0001_init.sql — コードジェンガ 初期スキーマ
-- ============================================================

-- ---------- ENUM 型 ----------
create type problem_source as enum ('gemini', 'seed');
create type room_status as enum ('waiting', 'playing', 'finished', 'closed');
create type game_status as enum ('waiting', 'generating', 'playing', 'finished', 'aborted');
create type turn_result as enum ('safe', 'out', 'timeout');
create type test_run_kind as enum ('problem_verification', 'turn_check');
create type test_run_status as enum ('passed', 'failed', 'error');
create type game_finish_reason as enum ('test_failed', 'timeout', 'no_lines_left', 'aborted');

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, is_anonymous)
  values (new.id, 'プレイヤー' || substr(new.id::text, 1, 4), coalesce(new.is_anonymous, true));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- problems ----------
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  source_code text not null,
  test_code text not null,
  language text not null,
  initial_line_count int not null check (initial_line_count > 0),
  generated_by problem_source not null default 'gemini',
  generation_prompt text,
  difficulty text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_problems_is_verified on public.problems (is_verified) where is_verified = true;

-- ---------- rooms ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references public.profiles (id) on delete cascade,
  status room_status not null default 'waiting',
  max_players int not null default 4 check (max_players between 2 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rooms_status on public.rooms (status);

-- ---------- games ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_no int not null default 1 check (round_no > 0),
  problem_id uuid references public.problems (id),
  status game_status not null default 'waiting',
  turn_no int not null default 0,
  current_player_id uuid references public.profiles (id),
  turn_time_limit_seconds int not null default 60 check (turn_time_limit_seconds > 0),
  turn_deadline_at timestamptz,
  current_code text,
  current_line_count int,
  loser_id uuid references public.profiles (id),
  finish_reason game_finish_reason,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, round_no)
);

create index idx_games_room_id on public.games (room_id);
create index idx_games_status on public.games (status);

-- ---------- game_players ----------
create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  turn_order int not null check (turn_order >= 0),
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (game_id, player_id),
  unique (game_id, turn_order)
);

create index idx_game_players_player_id on public.game_players (player_id);

-- ---------- test_runs ----------
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  kind test_run_kind not null,
  problem_id uuid references public.problems (id) on delete cascade,
  game_id uuid references public.games (id) on delete cascade,
  language text not null,
  language_version text not null,
  executed_code text not null,
  status test_run_status not null,
  exit_code int,
  stdout text,
  stderr text,
  compile_output text,
  total_tests int,
  passed_tests int,
  failed_tests int,
  duration_ms int check (duration_ms >= 0),
  piston_raw jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'problem_verification' and problem_id is not null)
    or (kind = 'turn_check' and game_id is not null)
  )
);

create index idx_test_runs_problem_id on public.test_runs (problem_id);
create index idx_test_runs_game_id on public.test_runs (game_id);

-- ---------- turns ----------
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn_no int not null check (turn_no > 0),
  player_id uuid not null references public.profiles (id),
  deleted_line_no int not null check (deleted_line_no > 0),
  deleted_line_text text not null,
  code_before text not null,
  code_after text not null,
  result turn_result not null,
  test_run_id uuid references public.test_runs (id) on delete set null,
  duration_ms int check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  unique (game_id, turn_no)
);

create index idx_turns_game_id on public.turns (game_id);
create index idx_turns_player_id on public.turns (player_id);

-- ---------- updated_at 自動更新 ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------- RLS 用ヘルパー関数 ----------
create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.game_players
    where game_id = p_game_id and player_id = auth.uid()
  );
$$;

-- ---------- RLS 有効化 ----------
alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.rooms enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.turns enable row level security;
alter table public.test_runs enable row level security;

-- ---------- RLS ポリシー ----------
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "problems_select_authenticated" on public.problems
  for select to authenticated using (true);

create policy "rooms_select_participant" on public.rooms
  for select to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1 from public.games g
      where g.room_id = rooms.id and public.is_game_participant(g.id)
    )
  );

create policy "games_select_participant" on public.games
  for select to authenticated using (public.is_game_participant(id));

create policy "game_players_select_participant" on public.game_players
  for select to authenticated using (public.is_game_participant(game_id));

create policy "turns_select_participant" on public.turns
  for select to authenticated using (public.is_game_participant(game_id));

create policy "test_runs_select_participant" on public.test_runs
  for select to authenticated
  using (
    kind = 'problem_verification'
    or (game_id is not null and public.is_game_participant(game_id))
  );

-- ---------- 入室用 RPC ----------
create or replace function public.join_room(p_code text)
returns uuid -- 参加した games.id を返す
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_room_status room_status;
  v_game_id uuid;
  v_next_order int;
begin
  select id, status into v_room_id, v_room_status
  from public.rooms
  where code = upper(p_code);

  if v_room_id is null then
    raise exception 'ROOM_NOT_FOUND: ルームコード % は存在しません', p_code;
  end if;

  if v_room_status not in ('waiting', 'playing') then
    raise exception 'ROOM_CLOSED: このルームは既に終了しています';
  end if;

  select id into v_game_id
  from public.games
  where room_id = v_room_id and status = 'waiting'
  order by round_no desc
  limit 1;

  if v_game_id is null then
    raise exception 'GAME_NOT_READY: 参加可能な試合がありません';
  end if;

  select coalesce(max(turn_order) + 1, 0) into v_next_order
  from public.game_players
  where game_id = v_game_id;

  insert into public.game_players (game_id, player_id, turn_order)
  values (v_game_id, auth.uid(), v_next_order)
  on conflict (game_id, player_id) do nothing;

  return v_game_id;
end;
$$;

grant execute on function public.join_room(text) to authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.turns;