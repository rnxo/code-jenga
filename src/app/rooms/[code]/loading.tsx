import { Spinner } from "@/components/ui/Spinner";

// 担当: FE-A

export default function RoomLoading() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4">
      <Spinner label="読み込み中..." />
    </main>
  );
}
