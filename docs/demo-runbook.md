# デモ当日 操作手順書（Vercel + ローカル Piston）

更新日: 2026-09-15
対象: `feat/backend-impl`
動作確認: 2026-09-15 に本手順で Vercel 本番からの 1 手判定（passed / failed）を確認済み

## 1. 目的

Vercel にデプロイしたアプリから、発表者の PC 上で動く Piston（コード実行サンドボックス）を使えるようにする。
VPS を借りずに無料で済ませるため、ローカル Docker の Piston を cloudflared Quick Tunnel で公開する。

## 2. 構成

```text
ブラウザ
  -> https://code-jenga.vercel.app（Next.js / Route Handler）
  -> https://xxxx.trycloudflare.com/api/v2/execute（Quick Tunnel、発表者の PC へ転送）
  -> Caddy（X-Piston-Key ヘッダーで認証、不一致は 401）
  -> Piston（127.0.0.1:2000、deno ランタイム）
```

- Quick Tunnel の URL は**起動ごとに変わる**。そのため起動スクリプトが毎回 Vercel の `PISTON_API_URL` を更新して再デプロイする。
- 共有キー `PISTON_API_KEY` は初回に生成して `%LOCALAPPDATA%\code-jenga\piston-api-key.txt` に保存され、以後は使い回す。
- 関連ファイル: `scripts/start-demo-tunnel.ps1`、`piston/docker-compose.public.yml`、`piston/Caddyfile`

## 3. 前提（初回のみ・完了済み）

| 項目 | 状態 | 確認コマンド |
|---|---|---|
| Docker Desktop | インストール済み | `docker compose version` |
| Vercel CLI ログイン | 済み（rnxo） | `vercel whoami` |
| Vercel プロジェクトリンク | 済み（`.vercel/repo.json`） | `vercel env ls production` |
| Vercel 環境変数（Supabase / Gemini / `PISTON_LANGUAGE` / `PISTON_LANGUAGE_VERSION`） | 設定済み | 同上 |
| deno ランタイム | 導入済み（Docker volume に保存） | `curl http://127.0.0.1:2000/api/v2/runtimes` |
| cloudflared | 取得済み（`%LOCALAPPDATA%\code-jenga\cloudflared.exe`） | スクリプトが無ければ自動取得 |

別の PC で発表する場合は、その PC で `vercel login` と `vercel link --yes --project code-jenga` を先に済ませること。
共有キーも PC ごとに生成されるため、Vercel 側の `PISTON_API_KEY` はスクリプトが上書きする。

## 4. 発表前の手順（毎回）

所要時間: 2〜3 分。発表の **10 分前**には終えておく。

1. PC を会場の Wi-Fi に接続する（接続後にスクリプトを実行すること。ネットワークが変わるとトンネルが張り直しになる）。
2. PC のスリープを切る（設定 > システム > 電源とバッテリー > 画面とスリープ）。
3. Docker Desktop を起動し、タスクトレイのアイコンが安定するまで待つ。
4. ターミナルを開き、リポジトリのルートで次を実行する。

   ```powershell
   pwsh scripts/start-demo-tunnel.ps1
   ```

   実行ポリシーで止まる場合:

   ```powershell
   pwsh -ExecutionPolicy Bypass -File scripts/start-demo-tunnel.ps1
   ```

5. 次の順でログが流れるのを確認する。

   ```text
   [1/4] Piston（公開版）を起動します
   [2/4] cloudflared は取得済みです
   [3/4] トンネル公開中: https://xxxx.trycloudflare.com/api/v2
   [4/4] Vercel の環境変数（production）を更新します
   再デプロイします
   ... vercel --prod のビルドログ ...
     PISTON_API_URL = https://xxxx.trycloudflare.com/api/v2
     PISTON_API_KEY = ...
   トンネルを維持しています。デモが終わったら Ctrl+C で終了してください
   ```

6. **このターミナルは閉じない**（最小化は可）。閉じるとトンネルが切れる。
7. ブラウザで https://code-jenga.vercel.app を開き、ルームを作って 1 手打つ。passed か failed が返れば OK。

## 5. 発表後の手順

1. スクリプトのターミナルで `Ctrl+C` を押す。トンネルだけ止まり、Docker コンテナは残る。
2. Piston を完全に止める場合:

   ```powershell
   docker compose -f piston/docker-compose.public.yml down
   ```

トンネルを止めた後の Vercel 本番は Piston に到達できず、手を打つと `error` になる。ハッカソン終了後に公開し続ける予定は無いので、そのままでよい。

## 6. スクリプトのオプション

| コマンド | 用途 |
|---|---|
| `pwsh scripts/start-demo-tunnel.ps1` | 通常運用。環境変数更新と本番再デプロイまで行う |
| `pwsh scripts/start-demo-tunnel.ps1 -NoDeploy` | 環境変数だけ更新する。Git プッシュ連携でデプロイしたいとき（反映には別途デプロイが必要） |
| `pwsh scripts/start-demo-tunnel.ps1 -SkipVercel` | Vercel を触らず値だけ表示する。ダッシュボードで手動設定するとき |

`vercel --prod` は**ローカルの作業ツリーをそのまま本番に上げる**。デモで見せたいブランチをチェックアウトした状態で実行すること。

## 7. トラブルシューティング

| 症状 | 原因の切り分け | 対処 |
|---|---|---|
| `Quick Tunnel の URL が取得できませんでした` | Cloudflare 側の一時的な不調 | もう一度実行する |
| `Caddy 経由で Piston に到達できません` | Docker が起動していない、または 80 番が他のプロセスに使われている | Docker Desktop を起動。`docker compose -f piston/docker-compose.public.yml logs caddy` を確認 |
| `vercel env add に失敗しました` | ログイン切れ、またはリンク未完了 | `vercel whoami` で確認し、必要なら `vercel login` → `vercel link --yes --project code-jenga` |
| ゲーム中に手を打つと `error` になる（Piston network） | トンネルが落ちている | スクリプトが終了していないか確認。終了していれば再実行（新 URL で再デプロイされる、約 1 分） |
| ゲーム中に `unauthorized` エラー | 共有キーの不一致 | `%LOCALAPPDATA%\code-jenga\piston-api-key.txt` の値と Vercel の `PISTON_API_KEY` を比べる。スクリプトを再実行すれば上書きされる |
| ゲーム中に `timeout` エラー | 会場の回線が遅い、または Piston のキュー待ち | 1 回なら再試行で解消する。続く場合は `docker compose -f piston/docker-compose.public.yml logs piston` を確認 |

リクエストが PC まで届いているかは次で確認できる（Caddy のアクセスログ）。

```powershell
docker compose -f piston/docker-compose.public.yml logs -f caddy
```

届いていなければトンネル側、届いていて 401 ならキー側の問題。

## 8. 注意事項

- Quick Tunnel は Cloudflare の無料機能で稼働保証が無い。発表中に切れた場合は再実行で復旧できるが、1 分程度かかる。
- 公開中は共有キーを知っていれば誰でも Piston でコードを実行できる。キーはチャットや画面共有に貼らないこと。
- Piston 側の実行制限（run 3 秒、出力 64KiB、同時 64 ジョブ）は `piston/docker-compose.public.yml` に定義している。Vercel 側の Route Handler は `maxDuration = 60` に設定済み。
