# 🧱 Code Jenga

for hack'z hackathon @ mosacup

**Gemini が生成したコードが、そのままジェンガのタワー（舞台）になります。**
プレイヤーは順番にそこから1行ずつ抜き取り、抜いたあとの実行でエラーが出たら「タワー崩壊」でその人の負け。
Gemini は舞台の作り手であり、同時に実況・審判でもあります。

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
- ③ の待機画面が、**Gemini がコードを生成しているあいだの待機**も兼ねます
- ホストは待たずに開始でき、全員が Ready になると自動で始まります
- どの画面を出すかは部屋の `phase`（lobby / playing / finished）で決まるので、全員の画面が揃って切り替わります

## 遊び方

1. ホストが開始すると **Gemini が舞台のコードを生成**します（③ の待機画面がそのまま「生成中」を兼ねます）
2. できあがった 10〜14 行のプログラムが **タワー**として全員の画面に並びます
3. 手番のプレイヤーが1行選んで **「抜き取る」**。抜いた直後に `startJenga()` として自動実行されます
4. エラーが出たら **タワー崩壊** — 抜いた人の負けで ⑤ 終了画面へ。無事なら次の人に手番が回ります
5. 全部抜き切れたら **全員の勝ち**
6. Gemini は毎手ごとに `安定 / グラグラ / 崩壊` を判定して実況します
7. 実行結果と Gemini のコメントは部屋に保存されるので、**全員が同じものを見ます**

舞台には「抜いても平気な行（ログ出力など）」と「抜くと即エラーになる行（あとで使う変数の宣言など）」が
混ざるように Gemini へ指示しています。

## 構成

| パス | 役割 |
| --- | --- |
| `app/page.tsx` | 画面の振り分けだけ。ロジックは持たない |
| `components/screens/` | ①〜⑤ の各画面。見た目はここだけ触れば変えられる |
| `components/ui.tsx` | Button / TextField / Panel など最小の見た目の部品 |
| `hooks/useCodeJenga.ts` | ゲーム全体。UI からはこれ1つを呼べば足りる |
| `hooks/useGameSession.ts` | 部屋・参加者・Ready・手番・決着の状態機械 |
| `hooks/useJengaTower.ts` | タワーの取得／舞台を並べる／抜く／実行 |
| `lib/fallbackStage.ts` | 鍵が無いときに使う作り置きの舞台 |
| `hooks/useGemini.ts` | Gemini の呼び出しと状態 |
| `app/api/gemini/route.ts` | Gemini 呼び出し。`mode: "build"` = 舞台を作る / `mode: "judge"` = 講評 |
| `app/api/execute/route.ts` | コード実行。Piston を叩き、使えなければクライアント側サンドボックスへフォールバック |
| `lib/supabase.ts` | Supabase クライアント。鍵が無ければローカル同期モード |
| `lib/localFallback.ts` | localStorage + BroadcastChannel による同一ブラウザ間の同期 |
| `lib/identityStore.ts` | 「自分がどの部屋の誰か」をタブ単位で覚えておく |
| `lib/sandbox.ts` | `sandbox="allow-scripts"` の iframe 内でコードを実行（4秒でタイムアウト） |
| `supabase/schema.sql` | Supabase 側のテーブル・RLS・Realtime 設定 |

## 環境変数

`.env.example` を参照してください。`GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com/apikey) で取得します。
**未設定でも `lib/fallbackStage.ts` の作り置きの舞台でゲームの流れは確認できます**が、
毎回同じ舞台になるので、遊ぶなら鍵を入れてください。

## 同期モードについて

- **Supabase 未設定**: localStorage + BroadcastChannel。同じブラウザの別タブ同士でリアルタイム同期します（別端末とは同期しません）。**タブを4つ開けば4人プレイの動作確認まではできます。**
- **Supabase 設定済み**: `supabase/schema.sql` を SQL Editor で流し、`NEXT_PUBLIC_SUPABASE_*` を設定すると Realtime で全端末が同期します。

## コード実行の安全性について

このゲームで一番難しいのは「1行抜かれたコードを安全に実行する」ところです。3段構えにしています。

### 1. 自前ホストの Piston（`PISTON_URL` を設定した場合）

コンテナ単位で隔離され、TypeScript の型注釈もそのまま通ります。本番はこれが本命です。
公開 Piston API は **2026/2/15 から whitelist 制**になり 401 を返すので、使うなら自前でホストしてください。

### 2. ブラウザ内の sandbox iframe（既定）

Piston に到達できないと、自動でこちらに切り替わります。次の5つを重ねています。

| 対策 | 効果 |
| --- | --- |
| `sandbox="allow-scripts"` のみ（`allow-same-origin` なし） | 不透明オリジンになり、アプリの DOM / localStorage / Cookie に触れない |
| CSP `default-src 'none'` | 中から fetch / XHR / WebSocket / 画像読み込みが一切できない |
| `eval` を使わない（`'unsafe-eval'` を許可しない） | コードは `<script>` に直接埋めて実行。文字列からの動的生成は塞いだまま |
| `allow-popups` / `allow-top-navigation` / `allow-forms` なし | 別タブを開いたり、親ページを飛ばしたりできない |
| 4秒でタイムアウトし iframe ごと破棄 | 同期の無限ループを書かれても、親スレッドのタイマーで止められる |

実際に Chrome 上で確認した結果:

```
parent.document      → SecurityError
parent.localStorage  → SecurityError
document.cookie      → SecurityError
location.origin      → "null"（不透明オリジン）
fetch('https://…')   → blocked (TypeError, CSP)
while (true) {}      → 親スレッドは 500ms 刻みで動き続け、破棄後も生存
構文エラー           → window.onerror で拾って「崩壊」として扱う
```

TypeScript のコンパイラは載せていないため、素の JavaScript として評価されます。
型注釈を使いたい場合は 1 の Piston を用意してください。

### 3. 残っている限界

- 実行はあくまで**プレイヤー自身のブラウザ**の中です。CPU を数秒使い切ることはできます（タイムアウトで止まります）
- いまタワーになるのは **Gemini が生成したコード**だけで、プレイヤーが任意のコードを書き込む経路はありません。
  もし将来プレイヤーがコードを書けるようにするなら、1 の Piston（またはサーバー側の隔離実行）に寄せてください
