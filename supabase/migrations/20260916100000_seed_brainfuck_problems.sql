-- Brainfuck のお題ストック用シード（5件）。
--
-- 背景: Gemini 生成の Brainfuck お題は「説明文の行 + 実行コード1行」という構成になりやすく、
-- どの行を消しても出力が変わらない（＝ゲームにならない）ものが DB に溜まっていた。
-- ここでは全行を 8 命令（+ - < > [ ] . ,）だけで構成し、
--   ・重要な行（値の構築・ループ・出力）を 5〜8 行に分散させる
--   ・削除しても出力が変わらない「実際の命令列」（+- / >< / >+< と >-< の組 / 未使用セルの >[-]< /
--     値が 0 のセルの [-] など）を半数程度混ぜる
-- ことで、消してよい行と消してはいけない行を読み解く駆け引きが成立するようにしている。
-- 投入前にローカルのインタプリタで全行を 1 行ずつ削除して実行し、期待出力とセーフ行数
-- （13〜17 行中 7〜10 行）を確認済み。
--
-- 既存 seed と同じ方針で is_verified は false で投入し、Piston での事前検証
-- （POST /api/problems/verify, scripts/verify-seed-problems.ps1）を通してから true にする。
-- Piston に brainfuck ランタイムが必要（scripts/setup-piston.* で導入される）。

-- 説明文主体の Gemini 生成 Brainfuck お題は未検証に戻し、試合開始時に配られないようにする
-- （games / turns から参照されている可能性があるため削除はしない）。
update public.problems
  set is_verified = false, safe_line_texts = null
  where language = 'brainfuck' and generated_by = 'gemini';

insert into public.problems (source_code, test_code, language, initial_line_count, generated_by, difficulty, is_verified)
values
(
$src$++++++++
[>+++++++++<-]
>.
+-
<>
>+<
+++++++++++++++++++++++++++++++++
>-<
.
[-]
>[-]<
><
-+$src$,
$test$Hi$test$,
  'brainfuck', 13, 'seed', 'easy', false
),
(
$src$+++++++++++
[>+++++++<-]
>++.
+-
----.
>+<
>-<
[-]
><
+++++++++++++++++++++++++++++++++
.
<>
-+
>[-]<$src$,
$test$OK!$test$,
  'brainfuck', 14, 'seed', 'easy', false
),
(
$src$++++++
[>++++++++<-]
>++++
+-
.
><
>>[-]<<
--.
>+<
>-<
[-]
<>
-+
>>+<<
>>-<<$src$,
$test$42$test$,
  'brainfuck', 15, 'seed', 'easy', false
),
(
$src$++++++++++
[>++++++<-]
>++++++.
+-
<>
>+<
+++++++++++++++++++++++++++++++++++++++++++++++++++++++.
>-<
><
>>[-]<<
--------------------
.
-+
>>+<<
>>-<<
[-]$src$,
$test$Bye$test$,
  'brainfuck', 16, 'seed', 'easy', false
),
(
$src$+++++++++
[>++++++++<-]
>-.
+-
><
>+<
>-<
++++++++++++++++++++++++++++++++++++++++
.
<>
>>[-]<<
[-]
-+
+++++++++++++++++++++++++++++++++
.
>>+<<
>>-<<$src$,
$test$Go!$test$,
  'brainfuck', 17, 'seed', 'easy', false
);
