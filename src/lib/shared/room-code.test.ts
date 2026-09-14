import { describe, expect, it } from "vitest";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "./room-code";

describe("isValidRoomCode", () => {
  it("英数字6桁は有効", () => {
    expect(isValidRoomCode("ABC123")).toBe(true);
  });

  it("桁数が違う場合は無効", () => {
    expect(isValidRoomCode("ABC12")).toBe(false);
    expect(isValidRoomCode("ABC1234")).toBe(false);
  });

  it("小文字が含まれる場合は無効", () => {
    expect(isValidRoomCode("abc123")).toBe(false);
  });
});

describe("generateRoomCode", () => {
  it("rooms.code の CHECK 制約を満たす形式を生成する", () => {
    const code = generateRoomCode();
    expect(isValidRoomCode(code)).toBe(true);
  });
});

describe("normalizeRoomCode", () => {
  it("前後の空白を除去し大文字化する", () => {
    expect(normalizeRoomCode(" abc123 ")).toBe("ABC123");
  });
});
