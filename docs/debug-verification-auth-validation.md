# 認可・入力検証・不正対策 デバッグ検証手順

## 事前準備

1. Supabase のマイグレーションを適用する。
2. `.env.local` の認証・Supabase 接続値を設定し、`pnpm dev` を起動する。
3. ブラウザーを2つ用意し、異なる認証ユーザー A / B でログインする。
4. `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm exec vitest run` を実行する。

## 入力検証

以下はすべて HTTP 400、`ok=false`、`error.code=VALIDATION_ERROR` になることを確認する。

```powershell
Invoke-WebRequest http://localhost:3000/api/rooms -Method Post -ContentType application/json -Body '{"maxPlayers":"4"}'
Invoke-WebRequest http://localhost:3000/api/rooms -Method Post -ContentType application/json -Body '{"nickname":""}'
Invoke-WebRequest http://localhost:3000/api/games/<gameId>/turns -Method Post -ContentType application/json -Body '{}'
Invoke-WebRequest http://localhost:3000/api/games/<gameId>/start -Method Post -ContentType application/json -Body '{"turnTimeLimitSeconds":1}'
Invoke-WebRequest http://localhost:3000/api/problems -Method Post -ContentType application/json -Body '{"difficulty":123}'
```

空ボディと壊れた JSON も同じ 400 になることを確認する。

## ルーム上限と権限

1. A が `maxPlayers=2` のルームを作成し、B が参加する。
2. C が参加し、HTTP 409 / `ROOM_FULL` になることを確認する。
3. 試合開始後の参加は HTTP 409 / `GAME_NOT_READY`、終了済みルームの参加は HTTP 409 / `ROOM_CLOSED` を確認する。
4. A が nickname を指定して作成し、B が nickname を指定して参加する。ロビーで表示名が更新されることを確認する。
5. 非参加者が `GET /api/games/<gameId>`、非ホストが `POST /api/games/<gameId>/start` を実行し、HTTP 403 / `FORBIDDEN` を確認する。

## 外部サービス API のレート制限

同じユーザーで `POST /api/problems` を連続2回実行し、2回目が HTTP 400 / `VALIDATION_ERROR` になることを確認する。`POST /api/problems/verify` も同様に確認し、別ユーザーでは独立して1回実行できることを確認する。

## DB での確認

```sql
select code, status, max_players from public.rooms order by created_at desc limit 5;
select game_id, count(*) from public.game_players group by game_id;
select has_function_privilege('anon', 'public.handle_new_user()', 'execute');
select has_function_privilege('authenticated', 'public.handle_new_user()', 'execute');
```

最後の2クエリは `false` であることを確認する。