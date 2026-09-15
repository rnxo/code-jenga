"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

// ロビーの入力欄。担当: FE-A
// ラベルは mono の小見出しで、盤面側の見出しと同じ組み方に揃える。

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
}

export function Field({ label, hint, className, ...rest }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">
        {label}
      </span>
      <input
        {...rest}
        className={[
          "rounded-md border border-gray-300 px-3 py-2 text-sm outline-none",
          "focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30",
          "dark:border-gray-700 dark:bg-gray-900",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  );
}
