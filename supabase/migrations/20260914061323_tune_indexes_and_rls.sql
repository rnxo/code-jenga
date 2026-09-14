-- 未インデックスの外部キーにインデックスを追加（advisor: unindexed_foreign_keys）
create index idx_games_current_player_id on public.games (current_player_id);
create index idx_games_loser_id on public.games (loser_id);
create index idx_games_problem_id on public.games (problem_id);
create index idx_rooms_host_id on public.rooms (host_id);
create index idx_turns_test_run_id on public.turns (test_run_id);

-- set_updated_at の search_path を固定（advisor: function_search_path_mutable）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- RLS ポリシーの auth.uid() 呼び出しを initplan 最適化（advisor: auth_rls_initplan）
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy "rooms_select_participant" on public.rooms;
create policy "rooms_select_participant" on public.rooms
  for select to authenticated
  using (
    host_id = (select auth.uid())
    or exists (
      select 1 from public.games g
      where g.room_id = rooms.id and public.is_game_participant(g.id)
    )
  );