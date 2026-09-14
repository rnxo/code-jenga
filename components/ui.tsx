"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

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
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-neutral-400">
      {label}
      <input
        {...props}
        className={`rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-amber-600 ${className}`}
      />
    </label>
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
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-neutral-950 p-5 text-neutral-100 sm:p-8">
      <div className={wide ? "" : "mx-auto w-full max-w-md"}>
        <h1 className="mb-1 text-2xl font-bold text-amber-500 sm:text-3xl">{title}</h1>
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
