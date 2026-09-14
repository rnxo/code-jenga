"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api/client";

// ルーム作成フォーム。担当: FE-A

export function CreateRoomForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await apiClient.createRoom({ nickname: nickname || undefined });

    if (result.ok) {
      router.push(`/rooms/${result.data.room.code}`);
    } else {
      setErrorMessage(result.error.message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "作成中..." : "ルームを作成"}
      </Button>
    </form>
  );
}
