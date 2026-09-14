-- ============================================================
-- add_turn_difficulty.sql — ランダム難易度ルーレット
-- ============================================================
-- ターンごとに EASY / NORMAL / HARD を抽選し、削除してよい行の種類に
-- 縛りをかける機能のための ENUM・列追加。
-- problems.difficulty（お題自体の難易度、text の自由記述）とは別概念のため
-- turn_ 接頭辞で区別する。

create type turn_difficulty as enum ('easy', 'normal', 'hard');

-- 現在の手番に適用されている難易度（非正規化キャッシュ）。
-- current_code / current_line_count と同じ扱いで、真実は turns.turn_difficulty 側。
-- 更新は必ず turns の INSERT と同一トランザクションで行うこと。
-- 手番が存在しない間（waiting / generating）は NULL。
alter table public.games
  add column current_turn_difficulty turn_difficulty;

comment on column public.games.current_turn_difficulty is
  '現在のターンに適用中の削除制限（EASY/NORMAL/HARD）。サーバーがターン開始時に均等抽選する。';

-- その手に実際に適用されていた難易度のスナップショット（履歴・リプレイ用）。
-- turns はまだ0行のため NOT NULL を直接付与できる。
alter table public.turns
  add column turn_difficulty turn_difficulty not null;

comment on column public.turns.turn_difficulty is
  'この手に適用されていた削除制限のスナップショット。';
