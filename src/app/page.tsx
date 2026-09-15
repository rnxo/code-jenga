import Link from "next/link";
import { OsekkaikunBackground } from "@/components/ui/OsekkaikunBackground";
import { Stack } from "@/components/ui/Stack";
import { TitleMascot } from "@/features/game";

// トップページ。担当: FE-A

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col gap-8 overflow-hidden px-4 pt-12 pb-52 md:pb-40">
      {/* おせっかい君の背景 */}
      <OsekkaikunBackground />

      <header className="text-center">
        <p className="mb-1 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
          pull one line
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          コードジェンガ
        </h1>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          AI が書いたコードを1行ずつ削除し合う、スリル満点のコーディングゲーム。
        </p>
      </header>

      {/* 物理演算する積み木 */}
      <Stack />

      {/* ゲーム開始 */}
      <div className="flex justify-center">
        <Link
          href="/roomhome"
          className="rounded-lg bg-black px-10 py-4 text-lg font-bold text-white transition hover:scale-105 hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          始める
        </Link>
      </div>

      {/* 右下に常駐するマスコット（#42） */}
      <TitleMascot />
    </main>
  );
}