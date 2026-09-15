import { CreateRoomForm, JoinRoomForm } from "@/features/lobby";

// トップページ（ルーム作成 / コード入室）。担当: FE-A

/** タイトル脇の飾り。積み木から1枚抜けている状態を出して、何のゲームかを伝える */
const STACK = [
  { label: "const total = sum(items);", pulled: false },
  { label: "items.forEach(add);", pulled: false },
  { label: "let sum = 0;", pulled: true },
  { label: "const items = [1, 2, 3];", pulled: false },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full min-h-full max-w-md flex-col gap-8 px-4 py-12 md:max-w-4xl md:gap-10 md:py-16">
      <header className="text-center">
        <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
          pull one line
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">コードジェンガ</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          AI が書いたコードを1行ずつ削除し合う、スリル満点のコーディングゲーム。
        </p>
      </header>

      {/* 何をするゲームかを、文章より先に絵で伝える。PC でも積み木が間延びしないよう幅は据え置き */}
      <div aria-hidden className="mx-auto flex w-full max-w-md flex-col gap-1.5">
        {STACK.map((block, index) => (
          <div
            key={block.label}
            className={`flex h-8 items-center gap-3 rounded-sm px-3 font-mono text-[11px] text-black/75 shadow-sm transition-transform ${
              index % 2 === 0 ? "bg-amber-600" : "bg-amber-700"
            } ${block.pulled ? "w-3/5 translate-x-1/3 ring-2 ring-red-400" : ""}`}
          >
            <span className="shrink-0 text-black/40">
              {String(STACK.length - index).padStart(2, "0")}
            </span>
            <span className="truncate">{block.label}</span>
          </div>
        ))}
        <div className="mt-1 h-1 rounded-full bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-700" />
      </div>

      {/* PC 幅では2カラム。スマホでは従来どおり縦積み */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-8">
        <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4 dark:border-gray-800 dark:bg-black/20">
          <h2 className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            create room
          </h2>
          <CreateRoomForm />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4 dark:border-gray-800 dark:bg-black/20">
          <h2 className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            join room
          </h2>
          <JoinRoomForm />
        </section>
      </div>
    </main>
  );
}
