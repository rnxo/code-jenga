# 🧱 Code Jenga

for hack'z hackathon @ mosacup

JavaScript のコードを1行ずつ「ブロック」として積み上げ、実行して崩れなければセーフ、という対戦ゲーム。
**Gemini が対戦相手（次の一手のコードを生成して積む）兼・審判（実行結果を講評）として参加します。**

## セットアップ

```bash
pnpm install
cp .env.example .env.local   # GEMINI_API_KEY を入れる
pnpm dev                     # http://localhost:3000
```

`.env.local` を変更したら dev サーバーを再起動してください。

## 遊び方

1. エディタに1行書いて **「➕ タワーに積む」**
2. **「🤖 Gemini に一手積ませる」** で Gemini がタワー全体を読み、次の1行と煽りコメントを返して積む
3. **「▶ タワーをテスト」** で `startJenga()` として全体を実行。続けて Gemini が `安定 / グラグラ / 崩壊` を判定して講評する
4. 他プレイヤーのブロックを **「抜き取る」** こともできる（本物のジェンガと同じで、抜いた後に崩れたら自己責任）

## 構成

| パス | 役割 |
| --- | --- |
| `app/page.tsx` | ゲーム画面（Monaco エディタ、タワー、Gemini 実況パネル） |
| `app/api/gemini/route.ts` | Gemini 呼び出し。`mode: "move"` = 一手を積む / `mode: "judge"` = 講評 |
| `app/api/execute/route.ts` | コード実行。Piston を叩き、使えなければクライアント側サンドボックスへフォールバック |
| `lib/supabase.ts` | Supabase クライアント。鍵が無ければローカル同期モード |
| `lib/localFallback.ts` | localStorage + BroadcastChannel による同一ブラウザ間の同期 |
| `lib/sandbox.ts` | `sandbox="allow-scripts"` の iframe 内でコードを実行（4秒でタイムアウト） |
| `supabase/schema.sql` | Supabase 側のテーブル・RLS・Realtime 設定 |

## 環境変数

`.env.example` を参照してください。`GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com/apikey) で取得します。

## 同期モードについて

- **Supabase 未設定**: localStorage + BroadcastChannel。同じブラウザの別タブ同士でリアルタイム同期します（別端末とは同期しません）。
- **Supabase 設定済み**: `supabase/schema.sql` を SQL Editor で流し、`NEXT_PUBLIC_SUPABASE_*` を設定すると Realtime で全端末が同期します。

## コード実行の安全性について

公開 Piston API は 2026/2/15 から whitelist 制になったため、既定では 401 が返ります。
その場合は自動的に **ブラウザ内の sandbox iframe**（`allow-same-origin` なし）で実行されます。
アプリのオリジンにも端末にもアクセスできない隔離環境なので、Gemini や他プレイヤーが積んだコードを実行しても安全です。
無限ループ対策として4秒のタイムアウトも入れています。

ただし TypeScript コンパイラは載せていないため、素の JavaScript として評価されます。
型注釈を使いたい場合は Piston を自前ホストして `PISTON_URL` を設定してください。
