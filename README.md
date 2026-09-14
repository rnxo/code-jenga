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

## 画面遷移

```
① スタート ─┬→ ② 部屋を作る（名前 + 合言葉）─┐
            └→ ②' 参加する（名前 + 合言葉）─┴→ ③ 待機 ─→ ④ コード ─→ ⑤ 終了
                                                                        ├→「このまま」→ ③へ
                                                                        └→「解散」→ ①へ
```

- ホストを含めて **最大4人**、**1マッチ**で決着します
- ③ の待機画面が、部屋を作った直後の「生成中の待機」も兼ねます
- ホストは待たずに開始でき、全員が Ready になると自動で始まります
- どの画面を出すかは部屋の `phase`（lobby / playing / finished）で決まるので、全員の画面が揃って切り替わります

## 遊び方

1. 手番のプレイヤーがエディタに1行書いて **「➕ タワーに積む」**（手番でない人の入力欄は読み取り専用）
2. **「🤖 Gemini に一手積ませる」** で Gemini がタワー全体を読み、次の1行と煽りコメントを返して積む
3. **「▶ タワーをテスト」** で `startJenga()` として全体を実行。続けて Gemini が `安定 / グラグラ / 崩壊` を判定して講評する
4. 実行でエラーが出たら **タワー崩壊**。直前に積んだ人の負けとして ⑤ 終了画面へ
5. 実行結果と Gemini のコメントは部屋に保存されるので、**全員が同じものを見ます**

## 構成

| パス | 役割 |
| --- | --- |
| `app/page.tsx` | 画面の振り分けだけ。ロジックは持たない |
| `components/screens/` | ①〜⑤ の各画面。見た目はここだけ触れば変えられる |
| `components/ui.tsx` | Button / TextField / Panel など最小の見た目の部品 |
| `hooks/useCodeJenga.ts` | ゲーム全体。UI からはこれ1つを呼べば足りる |
| `hooks/useGameSession.ts` | 部屋・参加者・Ready・手番・決着の状態機械 |
| `hooks/useJengaTower.ts` | ブロックの取得／積む／抜く／実行 |
| `hooks/useGemini.ts` | Gemini の呼び出しと状態 |
| `app/api/gemini/route.ts` | Gemini 呼び出し。`mode: "move"` = 一手を積む / `mode: "judge"` = 講評 |
| `app/api/execute/route.ts` | コード実行。Piston を叩き、使えなければクライアント側サンドボックスへフォールバック |
| `lib/supabase.ts` | Supabase クライアント。鍵が無ければローカル同期モード |
| `lib/localFallback.ts` | localStorage + BroadcastChannel による同一ブラウザ間の同期 |
| `lib/identityStore.ts` | 「自分がどの部屋の誰か」をタブ単位で覚えておく |
| `lib/sandbox.ts` | `sandbox="allow-scripts"` の iframe 内でコードを実行（4秒でタイムアウト） |
| `supabase/schema.sql` | Supabase 側のテーブル・RLS・Realtime 設定 |

## 環境変数

`.env.example` を参照してください。`GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com/apikey) で取得します。

## 同期モードについて

- **Supabase 未設定**: localStorage + BroadcastChannel。同じブラウザの別タブ同士でリアルタイム同期します（別端末とは同期しません）。**タブを4つ開けば4人プレイの動作確認まではできます。**
- **Supabase 設定済み**: `supabase/schema.sql` を SQL Editor で流し、`NEXT_PUBLIC_SUPABASE_*` を設定すると Realtime で全端末が同期します。

## コード実行の安全性について

公開 Piston API は 2026/2/15 から whitelist 制になったため、既定では 401 が返ります。
その場合は自動的に **ブラウザ内の sandbox iframe**（`allow-same-origin` なし）で実行されます。
アプリのオリジンにも端末にもアクセスできない隔離環境なので、Gemini や他プレイヤーが積んだコードを実行しても安全です。
無限ループ対策として4秒のタイムアウトも入れています。

ただし TypeScript コンパイラは載せていないため、素の JavaScript として評価されます。
型注釈を使いたい場合は Piston を自前ホストして `PISTON_URL` を設定してください。

## フロントエンドを触るとき

見た目を変えるなら `components/` だけで完結します。

- 共通の見た目 → `components/ui.tsx`（Button の色や角丸はここ）
- 各画面のレイアウト → `components/screens/*.tsx`
- ロジックには触らなくてよい → 必要な値と操作は `useCodeJenga()` が全部返します

`useCodeJenga()` が返すもの:

| 名前 | 中身 |
| --- | --- |
| `session` | 画面・部屋・参加者・自分・ホストか・エラー、部屋の操作一式 |
| `tower` | ブロック一覧・実行結果・積む/抜く/テスト |
| `gemini` | 接続状態・思考中か・コメント・判定 |
| `currentPlayer` / `isMyTurn` | 手番の制御 |
| `loser` | 崩した人 |
| `placeBlock` / `testTower` / `playGeminiMove` | ゲーム操作 |
