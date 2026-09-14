"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// 担当: FE-A
// Error Boundary（Client Component である必要がある）。

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-red-600">{error.message || "エラーが発生しました。"}</p>
      <Button onClick={reset}>もう一度試す</Button>
    </main>
  );
}
