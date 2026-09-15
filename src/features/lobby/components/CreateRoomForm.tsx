"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api/client";
import { Field } from "./Field";

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
      <Field
        label="your name"
        type="text"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        maxLength={20}
        placeholder="なまえ（任意）"
        hint="空のままだとプロフィールの名前を使います。"
      />
      {errorMessage ? (
        <p className="rounded-md border border-red-300 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "作成中..." : "ルームを作成"}
      </Button>
      <p className="text-[11px] text-gray-500">
        作成するとルームコードが発行されます。相手に伝えると入室できます。
      </p>
    </form>
  );
}
