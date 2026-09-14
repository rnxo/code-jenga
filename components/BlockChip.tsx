// 合言葉を積み木1個として見せるための部品。
// スタート画面のタワーアートと同じ質感にして、画面が変わっても地続きに見せる。

export function BlockChip({
  text,
  placeholder = "----",
}: {
  text: string;
  placeholder?: string;
}) {
  const empty = !text.trim();

  return (
    <div
      className={`flex h-10 items-center gap-3 rounded-sm px-3 shadow-md shadow-black/40 transition-colors ${
        empty ? "bg-neutral-800" : "bg-amber-600"
      }`}
    >
      <span
        className={`shrink-0 font-mono text-[10px] ${
          empty ? "text-neutral-600" : "text-black/40"
        }`}
      >
        01
      </span>
      <span
        className={`truncate font-mono text-[13px] ${
          empty ? "text-neutral-600" : "text-black/80"
        }`}
      >
        {empty ? placeholder : text}
      </span>
    </div>
  );
}
