import { CreateRoomForm, JoinRoomForm } from "@/features/lobby";

export default function RoomHomePage() {
  return (
    <main className="min-h-screen w-full px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            ルーム
          </h1>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            ルームを作成するか、コードを入力して参加してください。
          </p>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            create room
          </h2>

          <CreateRoomForm />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
            join room
          </h2>

          <JoinRoomForm />
        </section>
      </div>
    </main>
  );
}