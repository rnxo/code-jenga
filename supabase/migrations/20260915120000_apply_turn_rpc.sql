-- ============================================================
-- apply_turn_rpc.sql — 1手確定のトランザクション化（backend-todo 1-2 / 1-5）
-- ============================================================
-- applyTurn が test_runs INSERT → turns INSERT → games UPDATE を別リクエストで
-- 行っていたため、途中失敗で不整合が起きる / 同一プレイヤーの二重送信を防げなかった。
-- games 行を FOR UPDATE でロックし、3つの書き込みと決着時の rooms.status 更新を
-- 1関数内で行う。Piston 実行は関数の外（Route Handler）で行い、結果だけを渡す。
--
-- 呼び出しは service role のみ（anon / authenticated からは実行不可）。

create or replace function public.apply_turn(
  p_game_id uuid,
  p_player_id uuid,
  p_expected_turn_no int,
  p_deleted_line_no int,
  p_deleted_line_text text,
  p_code_after text,
  p_turn_result turn_result,
  p_next_player_id uuid,
  p_next_turn_difficulty turn_difficulty,
  p_finish_reason game_finish_reason,
  p_duration_ms int,
  p_test_run jsonb
)
returns jsonb -- { "turn": turns行, "game": games行 }
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_turn public.turns%rowtype;
  v_test_run_id uuid;
  v_is_finished boolean;
  v_code_before text;
begin
  -- 同一試合への同時書き込みを直列化する（二重送信は後続が turn_no 不一致で弾かれる）。
  select * into v_game
  from public.games
  where id = p_game_id
  for update;

  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND: 試合が見つかりません';
  end if;
  if v_game.status <> 'playing' then
    raise exception 'GAME_NOT_PLAYING: 試合中ではありません';
  end if;
  if v_game.current_player_id is distinct from p_player_id then
    raise exception 'NOT_YOUR_TURN: 現在の手番ではありません';
  end if;
  if v_game.turn_no <> p_expected_turn_no then
    raise exception 'NOT_YOUR_TURN: この手は既に確定済みです（turn_no=%）', v_game.turn_no;
  end if;
  if v_game.current_code is null or v_game.current_turn_difficulty is null then
    raise exception 'GAME_NOT_PLAYING: 試合のコード状態が不正です';
  end if;

  v_code_before := v_game.current_code;
  v_is_finished := p_finish_reason is not null;

  if not v_is_finished and (p_next_player_id is null or p_next_turn_difficulty is null) then
    raise exception 'VALIDATION_ERROR: 継続時は次の手番プレイヤーと難易度が必要です';
  end if;

  -- 1. test_runs（kind = 'turn_check'）
  insert into public.test_runs (
    kind, game_id, language, language_version, executed_code, status,
    exit_code, stdout, stderr, compile_output,
    total_tests, passed_tests, failed_tests, duration_ms, piston_raw, error_message
  ) values (
    'turn_check',
    p_game_id,
    p_test_run->>'language',
    p_test_run->>'language_version',
    p_test_run->>'executed_code',
    (p_test_run->>'status')::test_run_status,
    (p_test_run->>'exit_code')::int,
    p_test_run->>'stdout',
    p_test_run->>'stderr',
    p_test_run->>'compile_output',
    (p_test_run->>'total_tests')::int,
    (p_test_run->>'passed_tests')::int,
    (p_test_run->>'failed_tests')::int,
    (p_test_run->>'duration_ms')::int,
    p_test_run->'piston_raw',
    p_test_run->>'error_message'
  )
  returning id into v_test_run_id;

  -- 2. turns（turn_no は「現在の手番番号」をそのまま記録する。DB_DESIGN.md 5章-4）
  insert into public.turns (
    game_id, turn_no, player_id, deleted_line_no, deleted_line_text,
    code_before, code_after, turn_difficulty, result, test_run_id, duration_ms
  ) values (
    p_game_id, v_game.turn_no, p_player_id, p_deleted_line_no, p_deleted_line_text,
    v_code_before, p_code_after, v_game.current_turn_difficulty, p_turn_result, v_test_run_id, p_duration_ms
  )
  returning * into v_turn;

  -- 3. games
  update public.games
  set
    status = case when v_is_finished then 'finished'::game_status else 'playing'::game_status end,
    current_code = p_code_after,
    current_line_count = case when p_code_after = '' then 0
                              else array_length(string_to_array(p_code_after, E'\n'), 1) end,
    current_player_id = case when v_is_finished then null else p_next_player_id end,
    current_turn_difficulty = case when v_is_finished then null else p_next_turn_difficulty end,
    turn_no = v_game.turn_no + 1,
    turn_deadline_at = case when v_is_finished then null
                            else now() + make_interval(secs => turn_time_limit_seconds) end,
    loser_id = case when p_turn_result = 'out' then p_player_id else null end,
    finish_reason = p_finish_reason,
    finished_at = case when v_is_finished then now() else null end
  where id = p_game_id
  returning * into v_game;

  -- 決着時はルームを再戦可能な状態へ戻す（DB_DESIGN.md 5章-6）。
  if v_is_finished then
    update public.rooms set status = 'waiting' where id = v_game.room_id;
  end if;

  return jsonb_build_object('turn', to_jsonb(v_turn), 'game', to_jsonb(v_game));
end;
$$;

revoke execute on function public.apply_turn(
  uuid, uuid, int, int, text, text, turn_result, uuid, turn_difficulty, game_finish_reason, int, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_turn(
  uuid, uuid, int, int, text, text, turn_result, uuid, turn_difficulty, game_finish_reason, int, jsonb
) to service_role;

-- ------------------------------------------------------------
-- join_room: 一度離脱（left_at）したプレイヤーが再入室したら復帰させる（1-7）
-- ------------------------------------------------------------
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
  on conflict (game_id, player_id) do update set left_at = null;

  return v_game_id;
end;
$$;
