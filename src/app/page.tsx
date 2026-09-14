import { CreateRoomForm, JoinRoomForm } from "@/features/lobby";

// トップページ（ルーム作成 / コード入室）。担当: FE-A

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold">コードジェンガ</h1>
        <p className="mt-2 text-sm text-gray-600">
          AI が書いたコードを1行ずつ削除し合う、スリル満点のコーディングゲーム。
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500">ルームを作成する</h2>
        <CreateRoomForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500">ルームに入室する</h2>
        <JoinRoomForm />
      </section>
    </main>
  );
}
