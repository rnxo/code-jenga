import { describe, expect, it } from "vitest";
import { ApplicationError } from "@/lib/api/errors";
import {
  parseCreateProblemRequest,
  parseCreateRoomRequest,
  parseCreateTurnRequest,
  parseJoinRoomRequest,
  parseStartGameRequest,
  parseUpdateGameLanguageRequest,
} from "./validation";

function expectValidationError(action: () => unknown): void {
  expect(action).toThrowError(ApplicationError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code: "VALIDATION_ERROR" });
  }
}

describe("server request validation", () => {
  it("validates room and nickname boundaries", () => {
    expect(parseCreateRoomRequest({ nickname: " A ", maxPlayers: 2 })).toEqual({ nickname: "A", maxPlayers: 2 });
    expectValidationError(() => parseCreateRoomRequest({ maxPlayers: "2" }));
    expectValidationError(() => parseJoinRoomRequest({ nickname: "" }));
  });

  it("validates game controls", () => {
    expect(parseStartGameRequest({ turnTimeLimitSeconds: 60 })).toEqual({ turnTimeLimitSeconds: 60 });
    expectValidationError(() => parseStartGameRequest({ turnTimeLimitSeconds: 1 }));
    expectValidationError(() => parseCreateTurnRequest({ lineNo: 0 }));
    expect(parseUpdateGameLanguageRequest({ language: "python" })).toEqual({ language: "python" });
    expectValidationError(() => parseUpdateGameLanguageRequest({ language: "ruby" }));
    expectValidationError(() => parseUpdateGameLanguageRequest({}));
  });

  it("rejects malformed problem input", () => {
    expect(parseCreateProblemRequest({ difficulty: "easy" })).toEqual({ difficulty: "easy" });
    expectValidationError(() => parseCreateProblemRequest({ difficulty: 1 }));
  });
});