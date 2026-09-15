# お題生成・事前検証 手順書

更新日: 2026-09-15
対象: `feat/piston-impl`

## 1. 目的

Geminiで生成したTypeScriptのお題をPistonで事前検証し、検証済みのお題だけをゲームで利用できる状態にする。

この手順書はローカル開発環境を対象とする。クラウド環境では、`.env.local` のURLと秘密情報を各サービスの値へ置き換える。

## 2. 処理の概要

### お題生成API

```text
POST /api/problems
  -> GeminiでsourceCode / testCodeを生成
  -> problemsへ未検証で保存
  -> Pistonでテスト実行
  -> test_runsへ実行結果を保存
  -> 全テスト成功ならproblems.is_verified=true
```

生成と検証は最大3回試行する。すべて失敗した場合は `PROBLEM_GENERATION_FAILED` を返す。

### 試合開始時

```text
検証済みお題を検索
  -> 同一ルームの使用済みお題を可能な限り除外
  -> 難易度条件があれば絞り込み
  -> 候補からランダム選択

候補がない場合
  -> games.status = generating
  -> Gemini生成 + DB保存 + Piston検証を最大3回
  -> 失敗時は検証済みseedお題を検索
  -> お題を確保できたら games.status = playing
```

## 3. 必要な環境

- Node.js
- pnpm
- Docker Desktop
- Supabaseプロジェクト
- Gemini APIキー
- PowerShell

依存関係をインストールする。

```powershell
pnpm install
```

## 4. 環境変数を設定する

`.env.example` を `.env.local` にコピーする。

```powershell
Copy-Item .env.example .env.local
```

`.env.local` に以下を設定する。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
PISTON_API_URL=http://localhost:2000/api/v2
PISTON_LANGUAGE=deno
PISTON_LANGUAGE_VERSION=*
NEXT_PUBLIC_USE_MOCK_API=false
```

注意事項:

- `SUPABASE_SERVICE_ROLE_KEY` と `GEMINI_API_KEY` はクライアントへ公開しない。
- `PISTON_API_URL` は末尾に `/execute` を付けない。
- 実APIを確認する場合は `NEXT_PUBLIC_USE_MOCK_API=false` にする。
- `GEMINI_MODEL` は利用可能なGeminiモデル名へ変更できる。

## 5. DBマイグレーションを適用する

Supabaseプロジェクトへマイグレーションを適用する。Supabase CLIを利用する場合は、プロジェクトへリンクした後に実行する。

```powershell
supabase link --project-ref <project-ref>
supabase db push
```

シードお題は以下のマイグレーションで投入される。

```text
supabase/migrations/20260914140000_seed_problems.sql
```

シードお題は安全のため、初期状態では `is_verified=false` で登録される。

## 6. Pistonを起動する

別ターミナルでPistonを起動する。

```powershell
docker compose -f piston/docker-compose.yml up -d
```

起動確認:

```powershell
Invoke-RestMethod http://localhost:2000/api/v2/runtimes
```

Denoランタイムが表示されない場合は導入する。

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:2000/api/v2/packages `
  -ContentType "application/json" `
  -Body '{"language":"deno","version":"1.32.3"}'
```

Pistonの定義は [piston/docker-compose.yml](../piston/docker-compose.yml) にある。

## 7. Next.jsを起動する

```powershell
pnpm dev
```

通常は次のURLで起動する。

```text
http://localhost:3000
```

## 8. シードお題を検証する

`POST /api/problems/verify` は認証済みユーザーのCookieが必要である。

Piston起動、Denoランタイム確認、未検証お題の検証をまとめて実行する。

```powershell
.\scripts\verify-seed-problems.ps1 -Cookie "<認証Cookie>"
```

Pistonをすでに起動済みで、ランタイム導入も済んでいる場合:

```powershell
.\scripts\verify-seed-problems.ps1 -Cookie "<認証Cookie>" -SkipPistonSetup
```

クラウド上のNext.jsとPistonを使う場合:

```powershell
.\scripts\verify-seed-problems.ps1 `
  -BaseUrl "https://<app-domain>" `
  -PistonUrl "https://<piston-domain>/api/v2" `
  -Cookie "<認証Cookie>" `
  -SkipPistonSetup
```

成功時は次のような結果が返る。

```json
{
  "ok": true,
  "data": {
    "verified": ["<problem-id>"],
    "rejected": []
  }
}
```

### 認証Cookieの確認方法

1. ブラウザで `http://localhost:3000` を開く。
2. Supabase匿名ログイン済みの状態にする。
3. 開発者ツールを開く。
4. `Application` または `Storage` を開く。
5. 対象ドメインのCookieを確認する。
6. Supabaseセッションを構成するCookieを、`Cookie` ヘッダー形式で指定する。

例:

```text
sb-<project-ref>-auth-token=...
```

認証Cookieの値はログやドキュメントへ保存しない。

## 9. Geminiお題生成APIを確認する

認証Cookieを付けて、お題生成APIを実行する。

```powershell
$headers = @{ Cookie = "<認証Cookie>" }
$body = @{ difficulty = "easy" } | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/problems `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

成功すると、次の条件を満たす `problem` が返る。

- `language` が `typescript`
- `source_code` が空でない
- `test_code` が空でない
- `is_verified` が `true`
- Piston実行結果が `test_runs` に保存されている
- 実際に使った生成プロンプトが `generation_prompt` に保存されている

生成に失敗した場合は、最大3回の試行後にエラーとなる。失敗した候補は未検証のままDBへ残り、ゲームでは利用されない。

## 10. 試合開始時の自動フローを確認する

1. ルームを作成する。
2. 2人以上がルームへ参加する。
3. ホストが試合開始を実行する。
4. 既存の検証済みお題があれば、Geminiを呼ばずに選択される。
5. 同一ルームで使用済みのお題は可能な限り除外される。
6. 検証済みお題がない場合、ゲーム状態が一時的に `generating` になる。
7. Gemini生成とPiston検証が成功すると、ゲーム状態が `playing` になる。
8. Gemini生成に失敗した場合、検証済みの `seed` お題へフォールバックする。
9. それでもお題を確保できない場合、ゲーム状態が `waiting` に戻り、開始APIは `PROBLEM_GENERATION_FAILED` を返す。

確認対象:

- `games.status`
- `games.problem_id`
- `games.current_code`
- `problems.is_verified`
- `problems.generated_by`
- `test_runs.kind = 'problem_verification'`

## 11. 失敗時の切り分け

### Gemini APIエラー

確認する項目:

- `GEMINI_API_KEY` が設定されているか
- `GEMINI_MODEL` が有効なモデル名か
- Gemini APIの利用制限に達していないか
- 30秒以内に応答しているか

### Piston接続エラー

確認する項目:

- `docker compose -f piston/docker-compose.yml ps`
- `PISTON_API_URL` が正しいか
- `http://localhost:2000/api/v2/runtimes` にDenoが表示されるか
- Next.jsからPistonのURLへ接続できるか

### お題の事前検証エラー

確認する項目:

- `test_runs.status`
- `test_runs.stdout`
- `test_runs.stderr`
- `test_runs.error_message`
- Pistonのハーネスが対応しているMatcherか
- Geminiの出力にMarkdownフェンスや未対応構文がないか

### 検証済みお題がない

以下を再実行する。

```powershell
.\scripts\verify-seed-problems.ps1 -Cookie "<認証Cookie>"
```

その後、Supabaseで確認する。

```sql
select id, generated_by, difficulty, is_verified
from public.problems
order by created_at;
```

## 12. 自動チェック

実装確認として以下を実行する。

```powershell
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run
```

期待結果:

- TypeScriptエラーがない
- ESLintエラーがない
- 全テストが成功する

## 13. 関連ファイル

- [Gemini生成](../src/lib/server/gemini/generate-problem.ts)
- [Geminiプロンプト](../src/lib/server/gemini/prompt.ts)
- [お題準備](../src/lib/server/problems/prepare-problem.ts)
- [お題リポジトリ](../src/lib/server/repositories/problems.ts)
- [Piston検証](../src/lib/server/piston/verify-problem.ts)
- [お題生成API](../src/app/api/problems/route.ts)
- [シード検証API](../src/app/api/problems/verify/route.ts)
- [試合開始](../src/lib/server/game/start-game.ts)
- [環境変数例](../.env.example)
- [シード検証スクリプト](../scripts/verify-seed-problems.ps1)
