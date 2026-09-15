import { ApplicationError } from "@/lib/api/errors";
import type { CreateProblemRequest, CreateRoomRequest, CreateTurnRequest, JoinRoomRequest, StartGameRequest } from "@/types/api";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApplicationError("VALIDATION_ERROR", "リクエストボディは有効な JSON で指定してください。");
  }
}

function optionalNickname(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 20) {
    throw new ApplicationError("VALIDATION_ERROR", "nickname は1〜20文字の文字列で指定してください。");
  }
  return value.trim();
}

export function parseCreateRoomRequest(value: unknown): CreateRoomRequest {
  if (!isRecord(value)) throw new ApplicationError("VALIDATION_ERROR", "リクエスト形式が不正です。");
  const nickname = optionalNickname(value.nickname);
  if (value.maxPlayers !== undefined && (typeof value.maxPlayers !== "number" || !Number.isInteger(value.maxPlayers))) {
    throw new ApplicationError("VALIDATION_ERROR", "maxPlayers は整数で指定してください。");
  }
  return { nickname, maxPlayers: value.maxPlayers as number | undefined };
}

export function parseJoinRoomRequest(value: unknown): JoinRoomRequest {
  if (!isRecord(value)) throw new ApplicationError("VALIDATION_ERROR", "リクエスト形式が不正です。");
  return { nickname: optionalNickname(value.nickname) };
}

export function parseStartGameRequest(value: unknown): StartGameRequest {
  if (!isRecord(value)) throw new ApplicationError("VALIDATION_ERROR", "リクエスト形式が不正です。");
  const seconds = value.turnTimeLimitSeconds;
  if (seconds !== undefined && (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 5 || seconds > 600)) {
    throw new ApplicationError("VALIDATION_ERROR", "turnTimeLimitSeconds は5〜600秒の整数で指定してください。");
  }
  return { turnTimeLimitSeconds: seconds as number | undefined };
}

export function parseCreateTurnRequest(value: unknown): CreateTurnRequest {
  if (!isRecord(value) || typeof value.lineNo !== "number" || !Number.isInteger(value.lineNo) || value.lineNo < 1) {
    throw new ApplicationError("VALIDATION_ERROR", "lineNo は1以上の整数で指定してください。");
  }
  return { lineNo: value.lineNo };
}

export function parseCreateProblemRequest(value: unknown): CreateProblemRequest {
  if (!isRecord(value)) throw new ApplicationError("VALIDATION_ERROR", "リクエスト形式が不正です。");
  if (value.difficulty !== undefined && (typeof value.difficulty !== "string" || value.difficulty.trim().length > 30)) {
    throw new ApplicationError("VALIDATION_ERROR", "difficulty は30文字以内の文字列で指定してください。");
  }
  return { difficulty: value.difficulty as string | undefined };
}