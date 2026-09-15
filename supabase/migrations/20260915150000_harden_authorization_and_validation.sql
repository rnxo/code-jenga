create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_game_id uuid;
  v_next_order int;
  v_player_count int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED: 認証が必要です';
  end if;
  select * into v_room from public.rooms where code = upper(p_code) for update;
  if not found then raise exception 'ROOM_NOT_FOUND: ルームが見つかりません'; end if;
  if v_room.status not in ('waiting', 'playing') then raise exception 'ROOM_CLOSED: このルームは既に終了しています'; end if;
  select id into v_game_id from public.games where room_id = v_room.id and status = 'waiting' order by round_no desc limit 1;
  if v_game_id is null then raise exception 'GAME_NOT_READY: 参加可能な試合がありません'; end if;
  if exists (select 1 from public.game_players where game_id = v_game_id and player_id = auth.uid()) then return v_game_id; end if;
  select count(*)::int, coalesce(max(turn_order) + 1, 0) into v_player_count, v_next_order from public.game_players where game_id = v_game_id and left_at is null;
  if v_player_count >= v_room.max_players then raise exception 'ROOM_FULL: ルームの参加人数が上限に達しています'; end if;
  insert into public.game_players (game_id, player_id, turn_order) values (v_game_id, auth.uid(), v_next_order);
  return v_game_id;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;