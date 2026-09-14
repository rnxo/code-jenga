# コードジェンガ DBテーブル設計

アプリ概要・技術スタックは [`DESIGN.md`](./DESIGN.md) を参照。本ドキュメントは Supabase (PostgreSQL) 上のテーブル設計をまとめる。

対象 Supabase プロジェクト: `code-jenga`（ref: `twkuapsjczmlfldgjgot` / ap-northeast-1 / PostgreSQL 17）。本ドキュメント作成時点では `public` スキーマは空。

## 目次

1. [設計方針](#1-設計方針)
2. [ER図](#2-er図)
3. [ENUM 型定義](#3-enum-型定義)
4. [テーブル定義](#4-テーブル定義)
5. [ゲーム進行と DB 操作の対応](#5-ゲーム進行と-db-操作の対応)
6. [RLS ポリシー方針](#6-rls-ポリシー方針)
7. [Realtime 設定](#7-realtime-設定)
8. [マイグレーション SQL](#8-マイグレーション-sql全文)
9. [実装状況](#9-実装状況)
10. [未決事項・拡張余地](#10-未決事項拡張余地)

---

## 1. 設計方針

- **認証は Supabase Auth の匿名サインイン**。`auth.users` が全プレイヤーの主体となり、`public.profiles` に表示用のニックネームなどを持たせる。
- **ルームコードによる入室**。ホストがルームを作成すると6桁のコードが発行され、参加者はそのコードを入力して入室する（メールアドレス等の個人情報は扱わない）。
- **書き込みはサーバー側に一元化する**。ゲームロジック・手番の正当性検証・Piston でのテスト実行・セーフ/アウト判定はすべて Next.js の Route Handler（service role キー使用）で行い、**クライアントから `games` / `turns` / `test_runs` 等へ直接 INSERT / UPDATE させない**。これを徹底しないと「テストを実行せずに自己申告でセーフ判定を書き込む」といった不正が成立してしまう。
- クライアントは Supabase Realtime 経由で **SELECT（購読）のみ** を行う。唯一の例外は入室処理（[6. RLS ポリシー方針](#6-rls-ポリシー方針)参照）。
- 3日間のハッカソンで実装しきれる規模に抑えるため、テーブルは **7つ** に絞る。
- `any` を避ける方針（CLAUDE.md）に合わせ、状態を表す値は文字列ではなく Postgres の **ENUM 型**で表現し、アプリ側でも Supabase 生成の型からユニオン型として扱えるようにする。

### テーブル一覧

| テーブル | 役割 |
| --- | --- |
| `profiles` | プレイヤーの表示情報（`auth.users` の付随テーブル） |
| `problems` | AI が生成した「お題」（コード＋テストコード） |
| `rooms` | 対戦ルーム（入室コードの単位） |
| `games` | 1試合（ルーム内で複数回対戦できる） |
| `game_players` | 試合の参加者と手番順 |
| `turns` | 1手（1行削除）の記録 |
| `test_runs` | Piston でのテスト実行ログ |

---

## 2. ER図

```mermaid
erDiagram
    USERS ||--|| PROFILES : "has"
    PROFILES ||--o{ ROOMS : "hosts"
    PROFILES ||--o{ GAME_PLAYERS : "participates as"
    PROFILES ||--o{ TURNS : "plays"
    ROOMS ||--o{ GAMES : "runs"
    PROBLEMS ||--o{ GAMES : "used in"
    PROBLEMS ||--o{ TEST_RUNS : "verified by"
    GAMES ||--o{ GAME_PLAYERS : "has"
    GAMES ||--o{ TURNS : "has"
    GAMES ||--o{ TEST_RUNS : "produces"
    TEST_RUNS |o--o{ TURNS : "judges"

    USERS {
        uuid id PK
    }
    PROFILES {
        uuid id PK_FK
        text nickname
        boolean is_anonymous
    }
    ROOMS {
        uuid id PK
        text code UK "6桁の入室コード"
        uuid host_id FK
        room_status status
        int max_players
    }
    PROBLEMS {
        uuid id PK
        text source_code
        text test_code
        text language
        int initial_line_count
        boolean is_verified
    }
    GAMES {
        uuid id PK
        uuid room_id FK
        int round_no
        uuid problem_id FK
        game_status status
        int turn_no
        uuid current_player_id FK
        text current_code "非正規化: turnsから導出可能"
        int current_line_count "非正規化"
        uuid loser_id FK
        game_finish_reason finish_reason
    }
    GAME_PLAYERS {
        uuid game_id PK_FK
        uuid player_id PK_FK
        int turn_order
        boolean is_ready
    }
    TURNS {
        uuid id PK
        uuid game_id FK
        int turn_no
        uuid player_id FK
        int deleted_line_no
        text deleted_line_text
        turn_result result
        uuid test_run_id FK
    }
    TEST_RUNS {
        uuid id PK
        test_run_kind kind
        uuid problem_id FK
        uuid game_id FK
        test_run_status status
        int exit_code
    }
```

---

## 3. ENUM 型定義

| 型名 | 値 | 用途 |
| --- | --- | --- |
| `problem_source` | `gemini` / `seed` | お題の生成元 |
| `room_status` | `waiting` / `playing` / `finished` / `closed` | ルームの状態 |
| `game_status` | `waiting` / `generating` / `playing` / `finished` / `aborted` | 試合の状態 |
| `turn_result` | `safe` / `out` / `timeout` | 1手の判定結果 |
| `test_run_kind` | `problem_verification` / `turn_check` | テスト実行の目的 |
| `test_run_status` | `passed` / `failed` / `error` | テスト実行そのものの結果 |
| `game_finish_reason` | `test_failed` / `timeout` / `no_lines_left` / `aborted` | 試合が終了した理由 |

### 補足: `test_run_status` を3値にする理由

`passed` / `failed` の2値（boolean）にせず `error` を独立させているのが要点。**Piston 呼び出し自体の失敗（ネットワークエラー・レート制限・コンパイラクラッシュなど）を「テスト失敗＝アウト」と誤判定してはいけない**。`error` は「判定不能」を表し、アプリ側はこの場合ターンをアウト扱いにせずリトライ or エラーメッセージ表示を行う（CLAUDE.md の「エラーは握りつぶさず、意味のあるメッセージ付きで処理する」に対応）。

### 補足: `turn_result` と `game_finish_reason` を分けている理由

`turn_result` は「その1手がどうだったか」（`safe` / `out` / 制限時間切れの `timeout`）、`game_finish_reason` は「試合全体がなぜ終わったか」を表す。試合終了理由には `no_lines_left`（削除できる行がなくなった引き分け相当のケース）や `aborted`（ホストによる中断・全員離脱）など、個々の手の結果だけでは説明できない理由も含むため型を分離している。

---

## 4. テーブル定義

### 4.1 `profiles`

`auth.users` の付随情報。匿名サインイン時に `auth.users` へ INSERT が入ったタイミングでトリガーが自動生成する。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | ユーザーID（`auth.users` と同一） |
| `nickname` | `text` | NOT NULL, CHECK (1〜20文字) | 表示名。初期値はトリガーが自動採番、後で本人が変更可能 |
| `is_anonymous` | `boolean` | NOT NULL, DEFAULT `true` | 匿名サインインかどうか（将来の本登録機能拡張用） |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 更新日時（トリガーで自動更新） |

**インデックス**: PK のみで十分（参照は常に `id` 単体）。

---

### 4.2 `problems`

AI（Gemini）が生成した「お題」= 塔になるソースコードと、それを検証する Vitest のテストコード。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | お題ID |
| `source_code` | `text` | NOT NULL | 塔になる初期コード全文 |
| `test_code` | `text` | NOT NULL | 検証用の Vitest テストコード全文 |
| `language` | `text` | NOT NULL | Piston の言語識別子（例: `typescript`） |
| `initial_line_count` | `int` | NOT NULL, CHECK (`> 0`) | 初期状態の行数（残り行数の表示や終了判定に使用） |
| `generated_by` | `problem_source` | NOT NULL, DEFAULT `'gemini'` | 生成元 |
| `generation_prompt` | `text` | NULL 可 | Gemini に渡したプロンプト（再現・デバッグ用） |
| `difficulty` | `text` | NULL 可 | 難易度ラベル（自由記述、例: `easy`） |
| `is_verified` | `boolean` | NOT NULL, DEFAULT `false` | 削除前の状態で全テストがパスすることを確認済みか |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 作成日時 |

**インデックス**: `is_verified = true` の部分インデックス（ゲーム開始時に「使用可能なお題」を引くクエリを高速化）。

**補足**: `is_verified` は重要なフラグ。お題を生成した直後に一度 Piston で `source_code + test_code` を実行し、**削除前の状態で全テストが通ること**を確認してから `true` にする。これを経ずにゲームへ使うと、最初の1手を待たずに理不尽なアウトが発生しうる。デモの安定性のため、`generated_by = 'seed'` の手動お題を数件事前に投入し、Gemini API 障害時のフォールバックとする。

---

### 4.3 `rooms`

対戦ロビー。ホストが作成し、参加者は発行されたコードを入力して入室する。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | ルームID |
| `code` | `text` | NOT NULL, UNIQUE, CHECK (`^[A-Z0-9]{6}$`) | 入室コード（6桁の英数字） |
| `host_id` | `uuid` | NOT NULL, FK → `profiles(id)` | ホストのプレイヤーID |
| `status` | `room_status` | NOT NULL, DEFAULT `'waiting'` | ルームの状態 |
| `max_players` | `int` | NOT NULL, DEFAULT `4`, CHECK (2〜8) | 最大参加人数 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 作成日時 |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 更新日時 |

**インデックス**: `status` にインデックス（アクティブなルーム一覧取得用）。`code` は UNIQUE 制約により自動でインデックスが張られる。`host_id`（外部キー）にも Supabase Advisor の指摘に基づきインデックスを追加している。

**補足**: 同一ルームで何度も再戦できるよう、**ルーム（ロビー）と試合（`games`）を分離**している。「現在進行中の試合」は `rooms` に `current_game_id` のような列を持たせず、`games(room_id, round_no DESC)` の先頭行を引くことで求める。これは `rooms → games` と `games → rooms` の循環外部キーを避けるための設計判断。

---

### 4.4 `games`

1試合分の状態。ルーム作成と同時に `status = 'waiting'` の `games` 行が1つ作られ、参加者はこの行に紐づく `game_players` に登録される（＝ロビーで待っている状態と、対戦の手番順を同じ仕組みで表現する）。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | 試合ID |
| `room_id` | `uuid` | NOT NULL, FK → `rooms(id)` ON DELETE CASCADE | 所属ルーム |
| `round_no` | `int` | NOT NULL, DEFAULT `1`, CHECK (`> 0`) | ルーム内での試合番号（再戦のたびに +1） |
| `problem_id` | `uuid` | FK → `problems(id)` | 使用するお題（ロビー中は NULL 可） |
| `status` | `game_status` | NOT NULL, DEFAULT `'waiting'` | 試合の状態 |
| `turn_no` | `int` | NOT NULL, DEFAULT `0` | 現在の手番番号（次に記録される `turns.turn_no`） |
| `current_player_id` | `uuid` | FK → `profiles(id)` | 現在の手番のプレイヤー |
| `turn_time_limit_seconds` | `int` | NOT NULL, DEFAULT `60`, CHECK (`> 0`) | 1手あたりの制限時間 |
| `turn_deadline_at` | `timestamptz` | NULL 可 | 現在の手番の制限時刻 |
| `current_code` | `text` | NULL 可 | **非正規化**: 現時点のコード全文 |
| `current_line_count` | `int` | NULL 可 | **非正規化**: 現時点の残り行数 |
| `loser_id` | `uuid` | FK → `profiles(id)` | 負けたプレイヤー（決着後のみ） |
| `finish_reason` | `game_finish_reason` | NULL 可 | 試合終了理由 |
| `started_at` | `timestamptz` | NULL 可 | 開始日時 |
| `finished_at` | `timestamptz` | NULL 可 | 終了日時 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 作成日時 |

制約: `UNIQUE (room_id, round_no)`

**インデックス**: `room_id`、`status` にインデックス。加えて `current_player_id` / `loser_id` / `problem_id` の外部キーにも Supabase Advisor（`unindexed_foreign_keys`）の指摘に基づきインデックスを追加している。

**補足**:
- `current_code` / `current_line_count` は `turns` の最新行（`code_after`）から導出可能な**意図的な非正規化**。クライアントは `games` 1行を Realtime 購読するだけで盤面全体を再描画でき、`turns` テーブルを毎回 JOIN する必要がない。**更新は必ず `turns` の INSERT と同一トランザクションで行うこと**（ズレを防ぐため）。
- `winner_id` は持たない。DESIGN.md のルールは「ルーズ判定になったプレイヤーの負け」であり、3人以上対戦では勝者が一意に決まらないため、勝者は「`game_players` から `loser_id` を除いた集合」として都度算出する。

---

### 4.5 `game_players`

試合の参加者と手番順。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `game_id` | `uuid` | PK(1/2), FK → `games(id)` ON DELETE CASCADE | 試合ID |
| `player_id` | `uuid` | PK(2/2), FK → `profiles(id)` ON DELETE CASCADE | プレイヤーID |
| `turn_order` | `int` | NOT NULL, CHECK (`>= 0`) | 手番順（0始まり） |
| `is_ready` | `boolean` | NOT NULL, DEFAULT `false` | ロビーでの準備完了フラグ |
| `joined_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 入室日時 |
| `left_at` | `timestamptz` | NULL 可 | 離脱日時（途中離脱の記録用） |

制約: `PRIMARY KEY (game_id, player_id)`、`UNIQUE (game_id, turn_order)`

**インデックス**: `player_id` にインデックス（「自分が参加している試合一覧」を引くクエリ用）。

**補足**: ロビー参加者専用のテーブル（`room_players`）は作らない。ルーム作成時に生成される `status = 'waiting'` の `games` 行へ参加登録することで、「ロビーにいる人」＝「次の試合の手番順に並んでいる人」を1つの仕組みで表現する。再戦時は前局の `game_players` を新しい `games` 行にコピーする。手番送りは `left_at IS NULL` の参加者の中で `turn_order` を巡回する。

---

### 4.6 `test_runs`

Piston でのテスト実行ログ。**「お題の事前検証」と「ターンごとの判定」の両方をこのテーブル1つで扱う**（`kind` で区別）。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | 実行ID |
| `kind` | `test_run_kind` | NOT NULL | 実行目的 |
| `problem_id` | `uuid` | FK → `problems(id)` ON DELETE CASCADE, NULL 可 | `kind = 'problem_verification'` のとき必須 |
| `game_id` | `uuid` | FK → `games(id)` ON DELETE CASCADE, NULL 可 | `kind = 'turn_check'` のとき必須 |
| `language` | `text` | NOT NULL | Piston に渡した言語識別子 |
| `language_version` | `text` | NOT NULL | Piston に渡した言語バージョン（`*` で最新指定も可） |
| `executed_code` | `text` | NOT NULL | 実際に Piston へ送信したソース全文（対象コード＋テストコードを結合したもの） |
| `status` | `test_run_status` | NOT NULL | 実行結果 |
| `exit_code` | `int` | NULL 可 | プロセスの終了コード |
| `stdout` | `text` | NULL 可 | 標準出力 |
| `stderr` | `text` | NULL 可 | 標準エラー出力 |
| `compile_output` | `text` | NULL 可 | コンパイル時の出力（該当言語のみ） |
| `total_tests` | `int` | NULL 可 | 総テスト数（Vitest の出力をパースできた場合） |
| `passed_tests` | `int` | NULL 可 | 成功したテスト数 |
| `failed_tests` | `int` | NULL 可 | 失敗したテスト数 |
| `duration_ms` | `int` | CHECK (`>= 0`), NULL 可 | 実行時間 |
| `piston_raw` | `jsonb` | NULL 可 | Piston API のレスポンス全文（デバッグ用） |
| `error_message` | `text` | NULL 可 | `status = 'error'` のときの人間可読なエラーメッセージ |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 実行日時 |

制約: `CHECK ((kind = 'problem_verification' AND problem_id IS NOT NULL) OR (kind = 'turn_check' AND game_id IS NOT NULL))`

**インデックス**: `problem_id`、`game_id` にインデックス。

**補足**: `turns.test_run_id → test_runs.id` という参照方向にしている（`test_runs` 側は `turn_id` を持たない）。Piston の実行結果が確定してから `turns` 行を INSERT する順序と一致するため、循環参照を避けられる。

---

### 4.7 `turns`

1手（1行削除）の記録。

| カラム | 型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | 手のID |
| `game_id` | `uuid` | NOT NULL, FK → `games(id)` ON DELETE CASCADE | 試合ID |
| `turn_no` | `int` | NOT NULL, CHECK (`> 0`) | 手番番号（1始まり） |
| `player_id` | `uuid` | NOT NULL, FK → `profiles(id)` | 手を打ったプレイヤー |
| `deleted_line_no` | `int` | NOT NULL, CHECK (`> 0`) | 削除前コードにおける削除行番号（1始まり） |
| `deleted_line_text` | `text` | NOT NULL | 削除された行の内容 |
| `code_before` | `text` | NOT NULL | 削除前のコード全文 |
| `code_after` | `text` | NOT NULL | 削除後のコード全文 |
| `result` | `turn_result` | NOT NULL | この手の判定結果 |
| `test_run_id` | `uuid` | FK → `test_runs(id)` ON DELETE SET NULL, NULL 可 | 判定根拠となったテスト実行 |
| `duration_ms` | `int` | CHECK (`>= 0`), NULL 可 | このプレイヤーが手番開始から確定までにかけた時間 |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | 記録日時 |

制約: `UNIQUE (game_id, turn_no)`

**インデックス**: `game_id`（`turn_no` は UNIQUE 制約で複合インデックス済み）、`player_id`。`test_run_id`（外部キー）にも Supabase Advisor の指摘に基づきインデックスを追加している。

**補足**: `code_before` / `code_after` を毎手ごとに全文スナップショットとして保存する（差分からの再構築は行わない）。これによりリプレイ・巻き戻し・途中参加者への状態共有がすべて単純な `SELECT` で完結する。ハッカソン規模のコード量（数十〜百数十行程度）であれば容量上の問題にはならない。`test_run_id` は `ON DELETE SET NULL` とし、`games` の削除に伴う `test_runs` / `turns` の並行カスケード削除で外部キー違反が起きないようにしている。

---

## 5. ゲーム進行と DB 操作の対応

DESIGN.md のゲームフロー（お題生成 → 表示 → 1行削除 → テスト実行 → セーフ/ルーズ判定 → 繰り返し → 決着）を DB 操作に対応付ける。**すべて Route Handler（service role）から実行する。**

1. **ルーム作成**（ホスト）
   - `rooms` に1行 INSERT（`code` はランダムな6桁英数字を生成して採番、衝突時は再試行）
   - 直後に `games` へ `status = 'waiting'`, `round_no = 1` の1行を INSERT
   - ホスト自身を `game_players` へ `turn_order = 0` で INSERT

2. **お題生成＆検証**（ホストが開始操作をしたタイミング、または事前バッチ）
   - Gemini にプロンプトを投げてコード＋テストコードを取得し `problems` へ INSERT（`is_verified = false`）
   - Piston に `source_code + test_code` を投げて実行 → `test_runs`（`kind = 'problem_verification'`）へ結果を INSERT
   - 全テストがパスしていれば `problems.is_verified = true` に UPDATE。失敗/エラーなら `generated_by = 'seed'` のお題にフォールバック

3. **入室**（参加者）
   - クライアントが `join_room(code)` RPC を呼び出す（[6. RLS ポリシー方針](#6-rls-ポリシー方針)参照）
   - 該当 `games`（`status = 'waiting'`）の `game_players` へ、現在の最大 `turn_order + 1` で自分を INSERT

4. **試合開始**（ホストが開始操作、または人数が揃い全員 `is_ready`）
   - `games` を UPDATE: `status = 'playing'`, `problem_id`, `current_code = problems.source_code`, `current_line_count = initial_line_count`, `current_player_id = 先頭手番のプレイヤー`, `turn_no = 1`, `turn_deadline_at = now() + turn_time_limit_seconds`, `started_at = now()`

5. **1手の確定**（手番プレイヤーが行番号を指定して削除操作）
   - サーバーが `current_player_id` と一致することを検証（手番外の操作を拒否）
   - `games.current_code` から指定行を除いたコードを組み立て、Piston でテストを実行
   - 以下を **1トランザクション**で実行:
     1. `test_runs`（`kind = 'turn_check'`）へ実行結果を INSERT
     2. `turns` へ `code_before` / `code_after` / `result` / `test_run_id` を INSERT
     3. `games` を UPDATE: `current_code = code_after`, `current_line_count -= 1`, `turn_no += 1`。`result = 'safe'` なら次のプレイヤーへ `current_player_id` を回し `turn_deadline_at` を再セット。`result` が `'out'` / `'timeout'` なら `status = 'finished'`, `loser_id = そのプレイヤー`, `finish_reason`, `finished_at = now()` を設定

6. **決着後**
   - `rooms.status` は `'waiting'` に戻す（再戦可能にする）か、ホストが締めたら `'closed'` にする
   - 再戦する場合は新しい `games`（`round_no + 1`）を作成し、前局の `game_players` をコピーして再スタート

---

## 6. RLS ポリシー方針

- **`profiles`**: SELECT は認証済みユーザー全員に許可（対戦相手のニックネーム表示のため）。UPDATE は本人の行のみ。INSERT はトリガー経由のみ（クライアント向けの INSERT ポリシーは設けない）。
- **`problems`**: SELECT は認証済みユーザー全員に許可。INSERT / UPDATE / DELETE はクライアントに許可しない。
- **`rooms` / `games` / `game_players` / `turns` / `test_runs`**: 自分が参加している試合に関する行のみ SELECT を許可。INSERT / UPDATE / DELETE はクライアントに許可しない（service role のみが書き込む）。

### 入室処理だけが例外

「ルームコードで部屋を探す」操作は、参加する前のユーザーには本来その部屋の SELECT 権限がないため RLS だけでは表現できない。そこで **`join_room(code text)` を `SECURITY DEFINER` な RPC 関数として公開**し、認証済みユーザーなら誰でも呼び出せるようにする（呼び出し内部で `auth.uid()` を使って安全に `game_players` へ INSERT する）。この関数以外からのクライアント側書き込みは行わない。

### ポリシーの再帰を避ける

`games` のポリシーが `game_players` を参照し、`game_players` のポリシーが `games` を参照するような相互参照を素朴に書くと `infinite recursion detected in policy` エラーになる。これを避けるため、**`is_game_participant(p_game_id uuid) RETURNS boolean` を `SECURITY DEFINER` 関数として1つ定義し、`games` / `game_players` / `turns` / `test_runs` / `rooms` の全ポリシーからこの関数を呼ぶ**形に統一する。

---

## 7. Realtime 設定

盤面・手番・参加者の変化をクライアントへ即時反映するため、以下のテーブルを `supabase_realtime` publication に追加する。

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turns;
```

Postgres Changes は RLS を尊重するため、各クライアントには自分が参加している試合の変更のみが配信される。`problems` / `test_runs` は購読対象に含めない（クライアントは `games.current_code` の変化だけを見れば十分なため）。

---

## 8. マイグレーション SQL（全文）

Supabase プロジェクト `code-jenga`（`twkuapsjczmlfldgjgot`）に適用済み。以下は `init_schema` マイグレーションの内容（Supabase Advisor の指摘を受けて追加インデックス・`search_path` 固定・RLS の `auth.uid()` 最適化を行った `tune_indexes_and_rls` マイグレーションの内容を反映した最終形）。

```sql
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
create index idx_rooms_host_id on public.rooms (host_id);

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
create index idx_games_current_player_id on public.games (current_player_id);
create index idx_games_loser_id on public.games (loser_id);
create index idx_games_problem_id on public.games (problem_id);

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
create index idx_turns_test_run_id on public.turns (test_run_id);

-- ---------- updated_at 自動更新 ----------
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
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "problems_select_authenticated" on public.problems
  for select to authenticated using (true);

create policy "rooms_select_participant" on public.rooms
  for select to authenticated
  using (
    host_id = (select auth.uid())
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
```

---

## 9. 実装状況

Supabase プロジェクト `code-jenga`（ref: `twkuapsjczmlfldgjgot`）に上記スキーマを適用済み。

| マイグレーション | 内容 |
| --- | --- |
| `20260914061141_init_schema` | ENUM 7種・テーブル7つ・RLS・`is_game_participant()` / `join_room()` 関数・Realtime publication 登録 |
| `20260914061323_tune_indexes_and_rls` | Supabase Advisor 指摘への対応（未インデックス外部キー5件の追加、`set_updated_at()` の `search_path` 固定、`profiles_update_own` / `rooms_select_participant` ポリシーの `auth.uid()` 呼び出しを `(select auth.uid())` に変更して initplan 最適化） |

上記と同内容を `supabase/migrations/20260914061141_init_schema.sql` / `supabase/migrations/20260914061323_tune_indexes_and_rls.sql` としてリポジトリにも保存済み。ただし本リポジトリはまだ `supabase init` / `supabase link` を行っていないため（`supabase/config.toml` が無い）、Supabase CLI の `supabase db push` 等でこれらのファイルをそのまま適用することはできない。ローカル開発環境を構築する場合は別途セットアップが必要。

適用後に残っている Advisor の指摘（対応見送り、理由は以下）:

- **`unused_index`（INFO）**: 全テーブル 0 件のため未使用は当然。運用データが入ってから再確認する。
- **`anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`（WARN）**: `is_game_participant()` は RLS ポリシー内部から呼ばれるため EXECUTE 権限を剥奪するとポリシーごと機能しなくなるリスクがあり見送り。`join_room()` は意図的に公開している入室用 RPC のため対応不要。`handle_new_user()` はトリガー専用でクライアントから直接叩いても `NEW` レコード未定義のエラーになるだけだが、念のため権限を絞る余地はある（未対応）。

---

## 10. 未決事項・拡張余地

- **空行・コメント行の削除の扱い**: 現状は制約で禁止していない。ゲーム性を考えると `deleted_line_text` が空白のみ・コメントのみの行の削除を禁止する CHECK 制約、または `problems` 側でそもそも空行を含めない前処理のどちらかを検討する必要がある。
- **制限時間超過の検知方法**: `games.turn_deadline_at` を用意したが、超過を誰がどう検知するかは未設計（クライアントからのポーリング通知 / `pg_cron` による定期チェック / Vercel Cron など）。
- **`test_run_status = 'error'` 時のリトライ方針**: 何回までリトライするか、それでも失敗した場合にターンをどう扱うか（お題差し替え・引き分け等）は未決定。
- **対戦履歴の集計**: 勝率・対戦回数などの集計ビューは、必要になった時点で `turns` / `games` を元にした View または関数として追加する（現時点ではテーブルを増やさない）。
- **ホスト離脱時の扱い**: `rooms.host_id` が離脱した場合にルームをどうするか（自動的に次の参加者へ委譲する等）は未設計。
