"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Backdrop } from "@/components/Backdrop";

// 見た目の最小単位。デザインを変えるときはまずこのファイルを触れば全画面に効きます。

type Variant = "primary" | "secondary" | "gemini" | "danger" | "success";

const VARIANT: Record<Variant, string> = {
  primary: "bg-amber-500 text-black hover:bg-amber-400",
  secondary: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
  gemini: "bg-indigo-600 text-white hover:bg-indigo-500",
  danger: "bg-red-600 text-white hover:bg-red-500",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`cursor-pointer rounded px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function TextField({
  label,
  hint,
  trailing,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  /** 入力欄の右端に置くもの（サイコロボタンなど） */
  trailing?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-500 uppercase">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          {...props}
          className={`w-full rounded-md bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-100 ring-1 ring-neutral-800 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-amber-600 ${trailing ? "pr-11" : ""} ${className}`}
        />
        {trailing && <span className="absolute right-1.5">{trailing}</span>}
      </span>
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

/** スタート画面と同じ見出しの組み方。②以降の画面で使う */
export function ScreenHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <p className="mb-2 font-mono text-[11px] tracking-[0.3em] text-amber-600/80 uppercase">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-amber-500">{title}</h1>
      {lead && (
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">{lead}</p>
      )}
    </header>
  );
}

/** 主導線の下に置く控えめな戻り導線 */
export function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-5 w-full cursor-pointer text-center font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase transition hover:text-neutral-300"
    >
      ← back
    </button>
  );
}

export function Panel({
  title,
  accent = false,
  className = "",
  children,
}: {
  title?: ReactNode;
  accent?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-neutral-900 p-4 ${
        accent ? "border-indigo-800" : "border-neutral-800"
      } ${className}`}
    >
      {title && <h2 className="mb-3 text-sm font-semibold text-neutral-300">{title}</h2>}
      {children}
    </section>
  );
}

/** 画面の外枠。全画面で共通の余白と中央寄せを担当する */
export function Screen({
  title,
  subtitle,
  wide = false,
  children,
}: {
  /** 省略したときは ScreenHeader を children 側で組む */
  title?: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col [justify-content:safe_center] p-5 text-neutral-100 sm:p-8">
      <Backdrop />
      <div className={wide ? "" : "mx-auto w-full max-w-md"}>
        {title && (
          <h1 className="mb-1 text-2xl font-bold text-amber-500 sm:text-3xl">{title}</h1>
        )}
        {subtitle && <p className="mb-6 text-sm text-neutral-400">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}

export function ErrorBanner({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
      <span>{message}</span>
      <button onClick={onClose} className="cursor-pointer text-red-400 hover:text-red-200">
        ✕
      </button>
    </div>
  );
}
