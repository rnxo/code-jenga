"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api/client";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/shared/room-code";

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
      <label className="flex flex-col gap-1 text-sm">
        ルームコード
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={6}
          placeholder="ABC123"
          className="rounded-md border border-gray-300 px-3 py-2 uppercase tracking-widest"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ニックネーム（任意）
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={20}
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      <Button type="submit" variant="secondary" disabled={isSubmitting}>
        {isSubmitting ? "入室中..." : "ルームに入室"}
      </Button>
    </form>
  );
}
