import { ApplicationError } from "@/lib/api/errors";

const WINDOW_MS = 60_000;
const lastRequestByUser = new Map<string, number>();

export function enforceUserRateLimit(userId: string, operation: string): void {
  const key = `${operation}:${userId}`;
  const now = Date.now();
  const lastRequestAt = lastRequestByUser.get(key);
  if (lastRequestAt !== undefined && now - lastRequestAt < WINDOW_MS) {
    throw new ApplicationError("VALIDATION_ERROR", "この操作は1分に1回まで実行できます。");
  }
  lastRequestByUser.set(key, now);
}