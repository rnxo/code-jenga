import { CreateRoomForm, JoinRoomForm } from "@/features/lobby";

// ルーム画面（ルーム作成 / コード入室）。タイトル画面（/）の「始める」から遷移する。担当: FE-A

export default function RoomHomePage() {
  return (
    <main className="mx-auto flex w-full min-h-full max-w-md flex-col gap-8 px-4 py-12 md:max-w-4xl md:gap-10 md:py-16">
      <header className="text-center">
        <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
          pull one line
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">ルーム</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          ルームを作成するか、コードを入力して参加してください。
        </p>
      </header>

      {/* PC 幅では2カラム（#34 と同じ）。スマホでは縦積み */}
      {/* items-start にすると入力欄の数の差でカードの高さが揃わないので、stretch のままにする */}
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
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
