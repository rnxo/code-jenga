# Code Jenga 🧱

> AI が書いたコードから、1 行ずつ交互に消していく。
> テストが落ちた（＝タワーを崩した）プレイヤーの負け。

for hack'z hackathon @ mosacup

---

## 🎮 ゲームルール

```
1. AI（Gemini）が「テストが通るコード」を生成する
             ↓
2. 生成されたコードがプレイヤーに表示される（Monaco Editor）
             ↓
3. 自分のターン：コードを 1 行だけ削除する
             ↓
4. テストコードを走らせて SAFE / LOSE を判定する
             ↓
5. SAFE なら相手のターンへ（3 と 4 を繰り返す）
             ↓
6. LOSE 判定になったプレイヤーの負け
```

ジェンガと同じで、**「まだ抜けそうな行」を見抜く力**と、
**「相手が抜けなくなる状態」に追い込む力**が勝負になる。

---

## 🏗 技術構成

| 層 | 技術 | 状態 |
| --- | --- | --- |
| フロント | Next.js 16.3.5 (App Router) + React 19 + Tailwind CSS v4 | ✅ 導入済み |
| コード表示 / 編集 | 行ごとのボタン（Monaco は不使用） | ✅ `/play` で実装 |
| バックエンド | TypeScript（Next.js Route Handlers）| ✅ `/api/gemini`, `/api/execute` |
| AI | Gemini API | ✅ お題生成＋実況（要 `GEMINI_API_KEY`） |
| コード実行 | 隔離 iframe（案 A 相当）／自前 Piston に切替可 | ✅ 解消（下記） |
| テスト | Vitest（アプリ自体のテスト用）| ⬜ 未導入 |
| DB | Supabase（未設定なら localStorage にフォールバック）| ✅ スキーマ同梱 |
| 非同期ジョブ | ~~Redis + Celery/RQ~~ → 不採用 | ❌ 見送り |
| デプロイ | Vercel | ⬜ 未設定 |

> **バックエンドについて**：Next.js の App Router は UI とサーバー処理が同居する
> フルスタック構成なので、別サーバーは立てません。サーバー側の処理は
> `app/api/*/route.ts`（Route Handlers）と Server Actions で書きます。

---

## ⚠️ 調査で判明した技術的制約

> 2026-09-14 時点。当初の技術構成のうち **コード実行層に実際のブロッカー**があります。

### 🔴 1. Piston の公開 API は使えなくなっている

公開エンドポイントを実際に叩いたところ、認証エラーが返りました。

```console
$ curl -X POST https://emkc.org/api/v2/piston/execute ...
HTTP 401
{
  "message": "Public Piston API is now whitelist only as of 2/15/2026.
              Please host your own instance or go here and read the
              \"Important Note\" to see if you qualify for whitelisting:
              https://github.com/engineer-man/piston#public-api"
}
```

2026 年 2 月 15 日から**ホワイトリスト制**になっており、そのままでは利用できません。

**選択肢：**

| 案 | 内容 | 追加インフラ | 向き / 不向き |
| --- | --- | --- | --- |
| A | **ブラウザ内 Web Worker で実行** | なし | ⭐ 最速。Vercel だけで完結。クライアント実行なので理論上は改ざん可能（デモなら問題なし） |
| B | Vercel Function 内で `worker_threads` + タイムアウト | なし | サーバー権威で改ざん不可。実行時間上限（Hobby 10s）に注意 |
| C | Piston を Docker でセルフホスト（Fly.io / Railway） | Docker ホスト 1 台 | 当初構成に忠実・強い隔離。構築と運用のコストが乗る |
| D | Piston の whitelist を申請 | なし | 承認可否と所要期間が不明。締切があるとリスク大 |

### 🔴 2. Piston 上で Vitest は動かない

Piston で利用できる JS / TS ランタイムは以下だけで、**npm パッケージをインストールできません**。

| language | version | runtime |
| --- | --- | --- |
| javascript | 18.15.0 | node |
| typescript | 5.0.3 | tsc |
| javascript / typescript | 1.32.3 | deno |

そのため `import { expect } from 'vitest'` は解決できません。

**方針：テストを 2 種類に分ける。**

- **対戦中の SAFE / LOSE 判定** → Node 標準の `node:assert` / `node:test` で書く（依存ゼロ）
- **アプリ自体のユニットテスト** → Vitest（こちらは普通に使える）

### ❌ 3. Redis + Celery/RQ は構成と噛み合わない

- Celery / RQ は **Python 専用**。バックエンドが TypeScript なので言語が合わない
- Vercel は**常駐ワーカーを動かせない**
- そもそもコード実行は数秒で終わるため、**キューを挟む必要がない**

→ **この層は採用しません。** 将来どうしても必要になったら BullMQ ＋ 別ホストを検討します。

### 💡 4. 実行するコードは「任意のユーザー入力」ではない

ここが設計上いちばん効くポイントです。

実行対象は **「Gemini が生成したコードから、プレイヤーが行を削除したもの」** であり、
プレイヤーが任意のコードを書き込むわけではありません。

生成プロンプト側で

- 純粋関数のみ
- I/O なし（ファイル・ネットワーク・プロセス操作なし）
- 外部依存なし

と縛れば、**重量級サンドボックスは不要**になります。
これにより上記の案 A / B（追加インフラなし）が現実的な選択肢になります。

---

### ✅ ブロッカーへの回答（`/play` で実装済み）

案 A を選びました。ただし Web Worker ではなく **`allow-same-origin` を外した sandbox iframe** です。
Worker と違い不透明オリジンになるので、アプリの DOM / localStorage / Cookie に触れません。

| 対策 | 効果 |
| --- | --- |
| `sandbox="allow-scripts"` のみ | 不透明オリジン。アプリの DOM / localStorage / Cookie に触れない |
| CSP `default-src 'none'` | 中から fetch / XHR / WebSocket / 画像読み込みが一切できない |
| `eval` を使わない | `<script>` に直接埋めて実行。`'unsafe-eval'` を許可しない |
| popups / top-navigation / forms なし | 別タブを開いたり親ページを飛ばしたりできない |
| 4 秒でタイムアウトし iframe ごと破棄 | 同期の無限ループも親スレッドのタイマーで止まる |

Chrome での実測:

```
parent.document / parent.localStorage / document.cookie → SecurityError
location.origin  → "null"（不透明オリジン）
fetch('https://…') → blocked (TypeError, CSP)
while (true) {}  → 親は 500ms 刻みで動き続け、破棄後も生存
構文エラー        → window.onerror で拾って「崩壊」として扱う
```

案 C（自前 Piston）にも切り替えられます。`PISTON_URL` を設定すると、そちらを先に叩き、
到達できないときだけ iframe に落ちます。型注釈まで含めて走らせたい場合はこちらです。

なお ⚠️ 4 の指摘のとおり、実行対象は Gemini が生成したコードから行を削除したものだけで、
プレイヤーが任意のコードを書き込む経路はありません。将来それを作るなら案 C に寄せてください。

---

## 🤔 未決事項

実装を始める前にチームで決めたいこと。

- [x] **コード実行方式**：案 A（隔離 iframe）で実装。`PISTON_URL` で案 C にも切替可 → 上記参照
- [ ] **対戦方式**
  - ローカル交代（1 画面で 2 人が順番に操作）… Realtime 不要で最速
  - オンライン対戦（Supabase Realtime でルーム同期）… `/play` で実装済み（合言葉で最大 4 人）
  - 1 人 vs AI（Gemini が相手として行を選ぶ）… 1 人で遊べてデモしやすい
- [ ] **お題コードの言語**：JavaScript か TypeScript か（TS だと型エラーも「崩れる」条件にできて面白い）
- [ ] **削除できない行のルール**：空行・`}` のみの行・`import` 文を削除禁止にするか
- [ ] **引き分けの扱い**：削除できる行がなくなったらどうするか（`/play` では暫定で「全員の勝ち」）
- [ ] **難易度**：お題コードの行数・複雑さ、AI 相手の強さ

---

## 📁 ディレクトリ構成（予定）

フロント / バックでトップレベルを分ける構成は取りません。
App Router の規約に沿い、役割ごとに分けます。

```
app/
  layout.tsx
  page.tsx
  api/
    generate/route.ts     # Gemini でお題コードを生成
    judge/route.ts        # テスト実行と SAFE / LOSE 判定（案 B の場合）
components/               # 共通 UI（エディタ、ターン表示、勝敗モーダル）
lib/
  supabase/
    client.ts             # ブラウザ用クライアント
    server.ts             # サーバー用クライアント
  game/                   # ターン管理・勝敗ロジック（純粋関数）
  judge/                  # テスト実行の呼び出し
types/                    # DB スキーマ型・ゲーム状態の型
```

`tsconfig.json` に `@/*` のパスエイリアスが設定済みなので、
`@/lib/supabase/client` の形でインポートできます。

---

## 🗺 現在のルート

| URL | 中身 |
| --- | --- |
| `/` | ローカル交代の 2 人対戦（in-memory / Mock） |
| `/play` | 合言葉で部屋を作る最大 4 人のオンライン対戦。Gemini 生成・隔離実行つき |

どちらを front door にするかは未決です。`/play` を `/` にするならファイルを入れ替えるだけです。
`/play` 側の詳細は [docs/play.md](docs/play.md) にまとめてあります。

---

## 🚀 セットアップ

### 必要なもの

- Node.js 20 以上（開発環境では v24.11.1 で動作確認）
- pnpm 10.32.1（`packageManager` で指定済み）

pnpm が入っていない場合は Node 同梱の corepack を使えます。

```bash
corepack pnpm --version
```

### 手順

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定（下記参照）
#    .env.local を作成

# 3. 開発サーバーの起動
pnpm dev
```

http://localhost:3000 を開きます。

---

## 🔑 環境変数

`.env.local` に設定します（Git 管理対象外）。

| 変数名 | 用途 | 公開範囲 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL | クライアントに露出 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | クライアントに露出 |
| `GEMINI_API_KEY` | Gemini API キー | サーバー専用 |
| `GEMINI_MODEL` | 任意。既定は `gemini-2.5-flash` | サーバー専用 |
| `PISTON_URL` | 任意。自前ホストの Piston を使う場合のみ | サーバー専用 |

> ⚠️ `GEMINI_API_KEY` に `NEXT_PUBLIC_` を**付けないこと**。
> 付けるとクライアントのバンドルに埋め込まれ、キーが漏洩します。
> Gemini の呼び出しは必ず Route Handler（サーバー側）から行います。

> ⚠️ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` はクライアントに露出する前提のキーです。
> データ保護は **RLS（Row Level Security）ポリシー**で行ってください。

---

## 📜 開発コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー起動（Turbopack） |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番サーバー起動 |
| `pnpm lint` | ESLint |

---

## 🌿 ブランチ運用

| ブランチ | 用途 |
| --- | --- |
| `main` | リリース用 |
| `develop` | 開発用（こちらから作業ブランチを切る） |

---

## 📌 開発上の注意

この Next.js は **16.3.5** で、学習データと異なる破壊的変更が含まれます。
コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読んでください
（詳細は [AGENTS.md](AGENTS.md)）。

例：従来の `middleware.ts` は **`proxy.ts`** に変わっています。
