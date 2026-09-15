-- お題ごとの「削除しても全テストが通る行（セーフ行）」を保存する列を追加する。
-- 事前検証（src/lib/server/piston/verify-problem.ts）で 1 行ずつ削除して Piston で実行し、
-- 通った行のテキストを保存する。ターン難易度の抽選（src/lib/shared/difficulty.ts の
-- rollTurnDifficulty）は、この集合に含まれる削除可能行が残っている難易度まで
-- HARD -> NORMAL -> EASY と段階的に格下げする。
-- NULL は「未算出」を意味し、その場合は従来通り削除可能行の有無だけで判定する。
alter table public.problems
  add column safe_line_texts text[];

comment on column public.problems.safe_line_texts is
  '削除しても全テストが通る行のテキスト一覧（事前検証で算出）。NULL は未算出。';

-- 既存の検証済みお題は全件セーフ行が未算出で、削除できる行がほとんど無い（ゲームが成立しない）
-- ものが含まれる。一旦未検証に戻し、POST /api/problems/verify の再検証でセーフ行数の下限を
-- 満たしたものだけを再び検証済みにする。
update public.problems
  set is_verified = false
  where is_verified = true;
