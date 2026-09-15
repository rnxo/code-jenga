-- ============================================================
-- add_game_language.sql — 試合ごとの実行言語（TypeScript / Python）
-- ============================================================
-- ロビー（games.status = 'waiting'）でホストが選んだ実行言語を games に保持する。
-- お題の選択・生成条件として使い、Piston に渡す言語もここから決まる。
--
-- problems.language（text の自由記述）とは別概念:
--   - games.language     … 「この試合で使うと宣言された言語」
--   - problems.language  … 「そのお題が書かれている言語」
--   - test_runs.language … 「実際に Piston が実行したランタイム名」（TypeScript なら 'deno'）
--
-- 既存の試合・進行中の局を壊さないため、既定値は 'typescript'。
-- 列追加のみなので RLS ポリシー（行単位）と Realtime publication（テーブル単位）は変更不要。

create type code_language as enum ('typescript', 'python');

alter table public.games
  add column language code_language not null default 'typescript';

comment on column public.games.language is
  'この試合で使う実行言語。ロビー（status=waiting）でホストのみ変更でき、開始後は変更しない。';

-- 「その言語の検証済みお題」を引く経路（start-game.ts の3段フォールバック）が
-- 毎回フルスキャンにならないようにする。
create index idx_problems_verified_language
  on public.problems (language)
  where is_verified = true;
