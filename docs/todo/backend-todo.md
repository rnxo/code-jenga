# バックエンド TODO リスト

棚卸し日: 2026-09-15（ブランチ `feat/piston-impl`）

対象: `src/app/api/**`、`src/lib/server/**`、`src/lib/supabase/**`、`src/proxy.ts`、`supabase/migrations/**`、`piston/**`

## 現状サマリ

| 項目 | 状態 |
| --- | --- |
| Route Handler | 7本すべて実体あり（rooms / rooms/[code]/join / games/[gameId] / start / turns / problems / problems/verify） |
| Piston 実行基盤 | 実装済み（`run.ts` / `compose.ts` / `harness.ts` / `classify.ts` / `parse-vitest.ts`） |
| お題の事前検証 | 実装済み（`verify-problem.ts`、`POST /api/problems/verify`） |
| `pnpm exec vitest run` | 8ファイル 62件すべて成功 |
| `pnpm exec tsc --noEmit` / `pnpm lint` | エラーなし |

`docs/mock-branch-status.html` で BLOCKER だった「Piston 未実装」は解消済み。以下は実 DB モード（`NEXT_PUBLIC_USE_MOCK_API=false`）で1試合を通すために残っている問題と未実装項目。

凡例: 🔴 対戦が成立しない / 不正が通る　🟠 ゲーム体験に直接影響　🟡 品質・運用　⚪ 将来対応

---

## 1. 試合進行ロジック

### 🔴 1-1. 制限時間切れ（timeout）の処理が存在しない
- `games.turn_deadline_at` はセットされるだけで、超過しても誰も `turn_result='timeout'` / `finish_reason='timeout'` に倒さない。手番プレイヤーが放置すると試合が永遠に止まる。
- DB_DESIGN.md 10章の未決事項。方式候補: (a) クライアントから `POST /api/games/[gameId]/timeout` を叩き、サーバーが `now() > turn_deadline_at` を検証して確定する (b) `pg_cron` / Vercel Cron で定期チェック。
- ハッカソン規模では (a) が最小。誰が叩いても良い設計にし、サーバー側の時刻検証を必須にする。
- 関連: `src/lib/server/game/apply-turn.ts`、`src/lib/server/repositories/games.ts`

### 🔴 1-2. 1手確定がトランザクションになっていない
- `applyTurn` は `test_runs` INSERT → `turns` INSERT → `games` UPDATE を別々のリクエストで実行している。途中で失敗すると `turns` だけ残って `games` が古いままになる（DB_DESIGN.md 5章-5「1トランザクションで実行」に反する）。
- 同一プレイヤーの二重送信も防げない。2リクエストが同時に `current_player_id` チェックを通過し、後勝ちが `UNIQUE (game_id, turn_no)` 違反で `INTERNAL_ERROR` になる。
- 対応案: `apply_turn(...)` を SECURITY DEFINER の RPC（plpgsql）にして `games` 行を `FOR UPDATE` でロックし、3つの書き込みを1関数内で行う。Piston 実行は RPC の外で行い、結果だけを渡す。
- 関連: `src/lib/server/game/apply-turn.ts`、新規マイグレーション

### 🟠 1-3. 試合開始時の参加人数チェックがない
- `startGame` は参加者が1人（ホストのみ）でも開始できる。2人未満なら `VALIDATION_ERROR` で拒否する。
- `is_ready` フラグは DB に存在するが、更新する API も参照する処理もない。「全員 ready で開始」を採用しないなら仕様から外す判断も含めて決める。
- 関連: `src/lib/server/game/start-game.ts`

### 🟠 1-4. `turnTimeLimitSeconds` がリクエストで渡されても DB に保存されない
- `StartGameRequest.turnTimeLimitSeconds` を受け取って初回の `turn_deadline_at` 計算には使うが、`games.turn_time_limit_seconds` を更新しない。2手目以降は `applyTurn` が DB の既定値（60秒）を使うため、1手目と2手目以降で制限時間がズレる。
- `UpdateGameInput` に `turnTimeLimitSeconds` を追加して `startGame` で保存する。
- 関連: `src/lib/server/game/start-game.ts`、`src/lib/server/repositories/games.ts`

### 🟠 1-5. 試合終了後にルーム状態が戻らない
- `startGame` で `rooms.status='playing'` にするが、決着後に `'waiting'` または `'finished'` へ戻す処理がない。`join_room` RPC は `status in ('waiting','playing')` を許すので入室自体は通るが、`status='waiting'` の `games` が無いため `GAME_NOT_READY` で弾かれる。
- DB_DESIGN.md 5章-6 に従い、決着時に `rooms.status` を更新する。1-6 の再戦 API とセットで設計する。
- 関連: `src/lib/server/game/apply-turn.ts`、`src/lib/server/repositories/rooms.ts`

### 🟠 1-6. 再戦フロー（DB_DESIGN.md 5章-6）が未実装
- `copyGamePlayers` はリポジトリに存在するが呼び出し元がない。`POST /api/games/[gameId]/rematch`（または `POST /api/rooms/[code]/games`）を追加し、`games(round_no + 1)` を作成して参加者をコピーし、`rooms.status='waiting'` に戻す。
- フロント側は `ResultDialog` の「ロビーに戻る（再戦）」ボタンがルーム画面へ遷移するだけなので、API ができ次第つなぐ。
- `src/types/api.ts` にリクエスト／レスポンス型を追加（共有ファイルのためチーム合意が必要）。
- 関連: `src/lib/server/repositories/game-players.ts`、`src/types/api.ts`、`src/lib/api/client.ts`、`src/lib/api/mock.ts`

### 🟠 1-7. 離脱・中断（`left_at` / `aborted`）の処理が未実装
- `game_players.left_at` を更新する API がなく、`getNextPlayerId` の離脱者スキップが実際には機能しない。
- 手番中のプレイヤーが離脱した場合、ホストが離脱した場合（DB_DESIGN.md 10章「ホスト離脱時の扱い」）、全員離脱した場合（`finish_reason='aborted'`）の扱いが未設計。
- 最低限: `POST /api/games/[gameId]/leave` を追加し、手番中なら次のプレイヤーへ回す。残り1人なら `aborted` で終了する。
- 関連: `src/lib/server/game/turn-order.ts`、`src/lib/server/repositories/game-players.ts`

### 🟡 1-8. `game_status='generating'` が使われていない
- ENUM とフロントの分岐（「お題を生成中...」表示）は存在するが、サーバーは `waiting → playing` に直接遷移する。2-1 でお題生成を試合開始に組み込む場合、生成中は `'generating'` にして Realtime で待機画面を出す。
- 関連: `src/lib/server/game/start-game.ts`

### 🟡 1-9. `turn_no` の初期値がモックと不一致
- `startGame` は `turn_no=0` で開始し `applyTurn` が `+1` するため1手目は `turn_no=1` になる。一方 `src/lib/api/mock.ts` の `startGame` は `turn_no=1` を返す。仕様（DB_DESIGN.md 5章-4 は「`turn_no = 1`」と記載）とどちらに揃えるか決めて統一する。

---

## 2. お題生成（Gemini）と事前検証

### 🔴 2-1. お題生成が試合開始フローにつながっていない
- `startGame` は `findVerifiedProblem()` で既存の検証済みお題を1件拾うだけで、`POST /api/problems` を呼ぶ導線がフロントにもサーバーにもない。DB に検証済みお題が0件だと `PROBLEM_GENERATION_FAILED` で開始できない。
- 対応案: `startGame` の冒頭で `generateProblem → createProblem → verifyProblem` を試み、失敗したら `generated_by='seed'` の検証済みお題にフォールバックする（DB_DESIGN.md 5章-2）。生成中は 1-8 の `'generating'` 状態にする。
- 関連: `src/lib/server/game/start-game.ts`、`src/app/api/problems/route.ts`

### 🔴 2-2. シードお題が未検証のまま（デプロイ手順に組み込まれていない）
- `20260914140000_seed_problems.sql` は `is_verified=false` で投入し、`POST /api/problems/verify` を叩いて初めて使える。この手順が README にも起動スクリプトにもない。
- 環境構築手順に「Piston 起動 → deno ランタイム導入 → `/api/problems/verify` 実行」を明記するか、`scripts/` に検証スクリプトを追加する。
- 関連: `supabase/migrations/20260914140000_seed_problems.sql`、`src/app/api/problems/verify/route.ts`

### 🟠 2-3. お題の選択が固定・偏る
- `findVerifiedProblem` は `limit(1)` で常に同じ行を返す（ORDER BY なし）。再戦しても同じお題になる。
- ランダム選択（`order('created_at')` + オフセット、または RPC で `order by random()`）、`problems.difficulty` によるフィルタ、同一ルームで直近に使ったお題の除外を入れる。
- 関連: `src/lib/server/repositories/problems.ts`

### 🟠 2-4. Gemini プロンプトがハーネスの制約を伝えていない
- `harness.ts` は `CJ_SUPPORTED_MATCHERS` に列挙したマッチャーしか対応せず、未対応マッチャーは `__CJ_ERROR__`（判定不能）になる。しかし `prompt.ts` はマッチャー制限・`vi.mock` / `test.each` 禁止・非同期テスト・トップレベル宣言の重複禁止などを一切指示していない。
- `buildProblemGenerationPrompt` に `CJ_SUPPORTED_MATCHERS` を埋め込み、行数の目安（例: 15〜40行）と「1行削除で失敗し得る構造」の具体例を追加する。
- `generation_prompt` 列に実際のプロンプトを保存する（`createProblem` に渡していない）。
- 関連: `src/lib/server/gemini/prompt.ts`、`src/app/api/problems/route.ts`

### 🟡 2-5. Gemini モデル名の確認
- `generate-problem.ts` は `gemini-3.6-flash` を直書きしている。有効なモデル名か、環境変数で差し替え可能にするかを確認する。API エラー（404）時のメッセージは残っているので原因は追える。
- 関連: `src/lib/server/gemini/generate-problem.ts`

### 🟡 2-6. Gemini 呼び出しにタイムアウト・リトライがない
- `fetch` に `AbortSignal.timeout` がなく、Gemini が応答しないと Route Handler がハングする。`run.ts` と同様に 30秒程度のタイムアウトを入れる。
- 関連: `src/lib/server/gemini/generate-problem.ts`

---

## 3. 認可・入力検証・不正対策

### 🔴 3-1. `join_room` RPC が `max_players` を検証していない
- `rooms.max_players` を読まずに INSERT するため、上限を超えて入室できる。`ROOM_FULL` エラーはコードに存在するが実際には発生しない。
- RPC 内で `count(*) >= max_players` なら `raise exception 'ROOM_FULL: ...'` を追加する（新規マイグレーション）。
- 関連: `supabase/migrations/20260914061141_init_schema.sql`、`src/app/api/rooms/[code]/join/route.ts`

### 🟠 3-2. `join` のエラーマッピングが雑
- RPC の `ROOM_CLOSED` / `GAME_NOT_READY` はすべて `ROOM_FULL`（409）に丸められ、メッセージに `user: <uuid>` が混ざる。`ApiErrorCode` に `ROOM_CLOSED` / `GAME_NOT_READY` を追加するか、既存コードへ正しく振り分ける。
- 関連: `src/app/api/rooms/[code]/join/route.ts`、`src/types/api.ts`

### 🟠 3-3. `nickname` がサーバーで捨てられている
- `CreateRoomRequest.nickname` / `JoinRoomRequest.nickname` はフロントから送られるが、`POST /api/rooms` も `join` も `profiles.nickname` を更新しない。トリガー既定値「プレイヤーxxxx」のまま表示される。
- `profiles` リポジトリ（`updateNickname`）を追加し、両 Route Handler で 1〜20文字のバリデーション後に更新する。
- 関連: `src/app/api/rooms/route.ts`、`src/app/api/rooms/[code]/join/route.ts`、新規 `src/lib/server/repositories/profiles.ts`

### 🟠 3-4. お題生成・一括検証 API が認証済みなら誰でも叩ける
- `POST /api/problems` は Gemini と Piston を最大3回呼ぶため、匿名ユーザーが連打すると API コストとPiston 負荷が跳ねる。`POST /api/problems/verify` も同様に全未検証お題を直列で実行する。
- 最低限: ホスト権限（自分のルームが `waiting` のときだけ）に限定する、または簡易レートリミット（同一ユーザー 1分に1回）を入れる。`verify` は運用用途なので管理者トークンや環境変数によるガードを検討する。
- 関連: `src/app/api/problems/route.ts`、`src/app/api/problems/verify/route.ts`

### 🟡 3-5. リクエストボディの型検証が `as` キャストのみ
- 全 Route Handler が `body as XxxRequest` で受けており、`lineNo` 以外はフィールドの型を検証していない（`maxPlayers` に文字列が来ても `Number.isInteger` で弾けるが、`nickname` や `difficulty` はそのまま通る）。
- `unknown` からの型ガード関数を `src/lib/server/validation.ts` などにまとめ、`VALIDATION_ERROR` で返す。JSON パース失敗（空ボディ）も現状は `INTERNAL_ERROR` 500 になるので 400 にする。
- 関連: `src/app/api/**/route.ts`

### 🟡 3-6. `GET /api/games/[gameId]` の権限エラーコード
- 参加者でない場合に `UNAUTHENTICATED`（401）を返しているが、認証自体は済んでいるので `FORBIDDEN`（403）相当が適切。`ApiErrorCode` への追加が必要（共有ファイル）。
- `start` も同様に「試合が無い」「権限が無い」を区別せず `UNAUTHENTICATED` にしている。
- 関連: `src/app/api/games/[gameId]/route.ts`、`src/app/api/games/[gameId]/start/route.ts`

---

## 4. Piston / テストハーネス

### 🟠 4-1. Piston の同時実行・タイムアウト設定が未調整
- `run.ts` はクライアント側 10秒タイムアウト、リトライ含め 20秒。Piston 側の `run_timeout`（既定 3秒）と `output_max_size`（既定 1024バイト）はリクエストで明示していない。無限ループのお題で 3秒待ちになるのは許容範囲だが、`docker-compose.yml` の環境変数で `PISTON_RUN_TIMEOUT` などを明示しておく。
- 複数ルームが同時に手を打つと Piston がキューイングされ、`TEST_RUN_ERROR`（timeout）が出やすくなる。ハッカソンのデモ台数で問題ないか実測する。
- 関連: `piston/docker-compose.yml`、`src/lib/server/piston/run.ts`

### 🟠 4-2. Piston ランタイム導入が手動
- コンテナ起動直後はランタイムが無く、`docker-compose.yml` のコメントにある `curl` を手で叩く必要がある。`scripts/setup-piston.sh`（起動 → deno インストール → `/runtimes` 確認）を用意する。
- 関連: `piston/docker-compose.yml`、`scripts/`

### 🟡 4-3. `apply-turn.ts` の判定ロジックが `run.ts` と二重
- `exitCode === null ? "error" : exitCode === 0 ? "passed" : "failed"` を `apply-turn.ts` と `verify-problem.ts` の両方で書いている。`classifyPistonRun` が `outcome` を返しているので、`PistonRunResult` に `outcome` を載せて呼び出し側はそれを使う。
- `apply-turn.ts` の `loadProblem` が `await import("@/lib/supabase/admin")` で動的 import している。`problems` リポジトリに `findProblemById` を追加して置き換える。
- 関連: `src/lib/server/game/apply-turn.ts`、`src/lib/server/piston/run.ts`、`src/lib/server/repositories/problems.ts`

### 🟡 4-4. `TEST_RUN_ERROR` 時のリトライ・救済方針が未決定
- DB_DESIGN.md 10章の未決事項。現状は 502 を返してターンは進まず、同じプレイヤーがもう一度削除操作をやり直す動作になる。デモ中に Piston が落ちた場合の挙動（同じ手を再送できることの UI 表示）をフロントと合わせる。

---

## 5. Realtime / RLS / DB

### 🟠 5-1. `test_runs` の stdout / stderr が参加者に丸見え
- `test_runs_select_participant` ポリシーにより参加者は `executed_code`（ハーネス込みの全文）や `piston_raw` を SELECT できる。不正には直結しないが、`turns.test_run_id` 経由でフロントに失敗理由（`stderr`）を出すなら、必要な列だけを返す View を用意する。
- 関連: `supabase/migrations/20260914061141_init_schema.sql`

### 🟡 5-2. Realtime 購読の抜け
- `useGameRealtime` は `turns` INSERT を追加するだけで、再接続時に取りこぼした手を補完しない（`GET /api/games/[gameId]` は用意済みだが呼ばれていない）。バックエンド側は完成しているので、フロント担当への引き継ぎ事項。

### 🟡 5-3. Supabase CLI 未初期化
- `supabase/config.toml` がなく、`supabase db push` / ローカル Supabase でのマイグレーション適用ができない。新規マイグレーション（3-1、1-2）を追加する前に `supabase init` + `supabase link --project-ref twkuapsjczmlfldgjgot` を実施する。
- 関連: `supabase/`

### ⚪ 5-4. Advisor 指摘の残り
- `handle_new_user()` の EXECUTE 権限が `anon` / `authenticated` に残っている（DB_DESIGN.md 9章）。`revoke execute ... from anon, authenticated` を追加する。

---

## 6. テスト・運用

### 🟡 6-1. ゲームロジックの自動テストがない
- Vitest のカバレッジは `src/lib/shared/**` と `src/lib/server/piston/{classify,compose,harness,parse-vitest}` のみ。`apply-turn.ts` / `start-game.ts` / `turn-order.ts` / `judge.ts` / Route Handler はテストがない。
- リポジトリ層をインターフェース化するか、`createAdminClient` を `vi.mock` して `applyTurn` の分岐（NOT_YOUR_TURN / LINE_NOT_DELETABLE / out 判定 / no_lines_left）をテストする。`turn-order.ts` と `judge.ts` は純粋関数なのですぐ書ける。

### 🟡 6-2. 実 DB モードでの通し確認が未実施
- `.env.example` の既定が `NEXT_PUBLIC_USE_MOCK_API=true`。Piston 実装後に `false` で「ルーム作成 → 入室 → 開始 → 数手 → 決着」を通した記録がない。2-2 の手順を整えたうえで1回通し、問題があればここに追記する。

### 🟡 6-3. README がテンプレートのまま
- 環境変数（`.env.example`）、Piston 起動、シード検証、モック切り替えの手順が README にない。ドキュメント変更はユーザー許可が必要なため、ここでは項目としてのみ挙げる。

### ⚪ 6-4. ログ・監視
- Route Handler の例外は `toErrorResponse` でレスポンスに載るだけで、サーバーログには出ない。`console.error` で最低限のログを出すか、`INTERNAL_ERROR` 時だけスタックを記録する。

---

## 推奨着手順

1. 🔴 2-2 → 2-1: シード検証手順を整え、試合開始でお題が必ず確保されるようにする（これで実 DB モードの1試合が通る）
2. 🔴 1-1: タイムアウト API を追加する（放置で試合が止まるのを防ぐ）
3. 🔴 3-1 + 🟠 3-2 + 3-3: `join_room` の `max_players` 検証・エラーコード・nickname を1つのマイグレーション＋Route Handler 修正でまとめる
4. 🟠 1-3 / 1-4 / 1-5 / 1-6: 開始条件・制限時間の保存・終了後のルーム状態・再戦 API
5. 🔴 1-2: 1手確定の RPC 化（時間があれば。デモでは二重送信をフロントのボタン無効化で抑える暫定策も可）
6. 🟠 2-3 / 2-4: お題選択のランダム化とプロンプト改善
7. 🟡 以降は余力があれば
