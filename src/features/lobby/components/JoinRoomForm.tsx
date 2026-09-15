"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api/client";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/shared/room-code";
import { Field } from "./Field";

// ルームコード入室フォーム。担当: FE-A

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = normalizeRoomCode(code);

    if (!isValidRoomCode(normalizedCode)) {
      setErrorMessage("ルームコードは英数字6桁で入力してください。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await apiClient.joinRoom(normalizedCode, {
      nickname: nickname || undefined,
    });

    if (result.ok) {
      router.push(`/rooms/${normalizedCode}`);
    } else {
      setErrorMessage(result.error.message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        label="room code"
        type="text"
        value={code}
        onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
        maxLength={6}
        placeholder="ABC123"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="text-center font-mono text-xl tracking-[0.4em] uppercase"
        hint="ホストから聞いた英数字6桁。"
      />
      <Field
        label="your name"
        type="text"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        maxLength={20}
        placeholder="なまえ（任意）"
      />
      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={isSubmitting}>
        {isSubmitting ? "入室中..." : "ルームに入室"}
      </Button>
    </form>
  );
}
