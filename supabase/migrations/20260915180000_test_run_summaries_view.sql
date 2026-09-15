-- 5-1. test_runs の stdout / stderr / executed_code / piston_raw が参加者に丸見えになる問題への対応
--
-- 参加者（authenticated）には「失敗理由の表示に必要な列だけ」を公開する。
-- - 基底テーブル public.test_runs の SELECT 権限を列単位に絞る
--   （executed_code / piston_raw / stdout は非公開。ハーネス全文や生レスポンスは見せない）
-- - 公開列だけを返す View public.test_run_summaries を security_invoker で作成する
--   （RLS ポリシー test_runs_select_participant は基底テーブル側でそのまま効く。
--     security_definer にしないので Supabase Advisor の security_definer_view 警告も出ない）
-- - サーバー側（service_role）は今まで通り test_runs を直接読み書きする

-- 基底テーブル: 列単位の SELECT 権限に絞る
revoke select on table public.test_runs from anon, authenticated;
grant select (
  id,
  kind,
  game_id,
  problem_id,
  status,
  exit_code,
  stderr,
  compile_output,
  total_tests,
  passed_tests,
  failed_tests,
  duration_ms,
  error_message,
  created_at
) on table public.test_runs to authenticated;

-- 公開列だけを返す View
create view public.test_run_summaries
with (security_invoker = true)
as
select
  id,
  kind,
  game_id,
  problem_id,
  status,
  exit_code,
  stderr,
  compile_output,
  total_tests,
  passed_tests,
  failed_tests,
  duration_ms,
  error_message,
  created_at
from public.test_runs;

comment on view public.test_run_summaries is
  'test_runs のうち参加者に公開して良い列だけを返す View。executed_code / piston_raw / stdout は含まない。';

revoke all on table public.test_run_summaries from anon;
grant select on table public.test_run_summaries to authenticated;
