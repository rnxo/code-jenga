import Link from "next/link";
import { OsekkaikunBackground } from "@/components/ui/OsekkaikunBackground";
import { Stack } from "@/components/ui/Stack";
import { TitleMascot } from "@/features/game";

// トップページ。担当: FE-A

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col gap-8 overflow-hidden px-4 py-12">
      {/*
       * 背景は洋楽のジャケットふうの1枚。正方形に切ってあるので、
       * レコードのジャケットのように大きめに据える。
       *
       * 出どころ: Unsplash / Pawel Czerwinski
       *   https://unsplash.com/photos/sE97eb0WhGI
       *   Unsplash License（商用可・クレジット不要）
       *   https://unsplash.com/license
       *
       * 実在のアーティストのジャケットは著作権があるので使えない。
       * 「ジャケットに見える絵」を自由に使えるところから持ってきている。
       */}
      <OsekkaikunBackground
        src="/images/backgrounds/jacket.jpg"
        opacity={0.3}
        maxSizePx={760}
        blend="normal"
      />

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
      <div className="relative flex justify-center">
        <Link
          href="/roomhome"
          className="rounded-lg bg-black px-10 py-4 text-lg font-bold text-white transition hover:scale-105 hover:bg-gray-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          始める
        </Link>

        {/*
         * おせっかいくん（#42）。ボタンに吹き出しを被せて、わざと押しにくくする。
         * 「黙らせる」で退くと押しやすくなる。キャラはボタンの右に立ち、吹き出しが左へ伸びて被る
         */}
        <div className="absolute top-1/2 right-1/2 translate-x-[8.5rem] -translate-y-1/2">
          <TitleMascot />
        </div>
      </div>
    </main>
  );
}