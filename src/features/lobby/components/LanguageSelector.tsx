"use client";

import type { CodeLanguage } from "@/types/game";
import { LANGUAGE_LABEL, SUPPORTED_LANGUAGES } from "@/lib/shared/language";

// ロビーでの実行言語の選択。担当: FE-A
//
// ホストだけが切り替えられ、参加者には現在の言語を表示するだけにする。
// 押せそうな見た目の disabled ボタンを参加者に見せるより、最初から表示専用にした方が誤解が少ない。
// 選択結果は games.language に保存され、Realtime の games UPDATE で全員へ同期される。

export interface LanguageSelectorProps {
  language: CodeLanguage;
  isHost: boolean;
  /** 更新中・開始処理中・開始後など、操作を受け付けない間は true */
  disabled: boolean;
  onChange: (next: CodeLanguage) => void;
  errorMessage: string | null;
}

export function LanguageSelector({ language, isHost, disabled, onChange, errorMessage }: LanguageSelectorProps) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-gray-500 uppercase">language</p>

      {isHost ? (
        <div role="group" aria-label="実行言語" className="flex gap-1.5">
          {SUPPORTED_LANGUAGES.map((candidate) => {
            const isSelected = candidate === language;
            return (
              <button
                key={candidate}
                type="button"
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => onChange(candidate)}
                className={`flex h-11 flex-1 items-center justify-center rounded-sm px-3 font-mono text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelected
                    ? "bg-amber-600 text-black/85"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {LANGUAGE_LABEL[candidate]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex h-11 items-center rounded-sm bg-amber-600 px-3 font-mono text-sm text-black/85 shadow-sm">
          <span className="flex-1">{LANGUAGE_LABEL[language]}</span>
          <span className="shrink-0 text-[10px] tracking-[0.15em] text-black/50 uppercase">host&apos;s pick</span>
        </div>
      )}

      {errorMessage ? (
        <p className="mt-2 rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
