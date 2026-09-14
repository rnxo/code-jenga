"use client";

import { Button, ErrorBanner, Screen } from "@/components/ui";
import type { GameSession } from "@/hooks/useGameSession";

/** ① スタート画面 */
export function StartScreen({ session }: { session: GameSession }) {
  return (
    <Screen
      title="🧱 Code Jenga"
      subtitle="コードを1行ずつ積み上げ、崩さずに耐えるゲーム。Gemini が対戦相手にも審判にもなります。"
    >
      <ErrorBanner message={session.error} onClose={session.clearError} />

      <div className="flex flex-col gap-3">
        <Button onClick={() => session.goTo("create")}>部屋を作る</Button>
        <Button variant="secondary" onClick={() => session.goTo("join")}>
          参加する
        </Button>
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        {session.isSyncedRemotely
          ? "ホストを含めて4人まで、1マッチで決着します。"
          : "ローカル同期モードです。同じブラウザの別タブを開けば4人分の動きを確認できます（別端末とは同期しません）。"}
      </p>
    </Screen>
  );
}
