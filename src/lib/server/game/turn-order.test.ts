import { describe, expect, it, vi } from "vitest";

// "server-only" は Next.js のサーバー境界チェック用モジュールで、Vitest 上では読み込めないため空にする。
vi.mock("server-only", () => ({}));

import type { GamePlayer } from "@/types/game";
import { getActivePlayers, getNextPlayerId, getNextPlayerIdAfterLeave } from "./turn-order";

function player(playerId: string, turnOrder: number, leftAt: string | null = null): GamePlayer {
  return {
    game_id: "game",
    player_id: playerId,
    turn_order: turnOrder,
    is_ready: false,
    joined_at: "2026-09-15T00:00:00.000Z",
    left_at: leftAt,
  };
}

describe("getActivePlayers", () => {
  it("離脱者を除いて turn_order 昇順で返す", () => {
    const players = [player("c", 2), player("a", 0), player("b", 1, "2026-09-15T01:00:00.000Z")];
    expect(getActivePlayers(players).map((p) => p.player_id)).toEqual(["a", "c"]);
  });
});

describe("getNextPlayerId", () => {
  it("turn_order を巡回し、末尾の次は先頭に戻る", () => {
    const players = [player("a", 0), player("b", 1), player("c", 2)];
    expect(getNextPlayerId(players, "a")).toBe("b");
    expect(getNextPlayerId(players, "c")).toBe("a");
  });

  it("離脱者を飛ばす", () => {
    const players = [player("a", 0), player("b", 1, "2026-09-15T01:00:00.000Z"), player("c", 2)];
    expect(getNextPlayerId(players, "a")).toBe("c");
  });

  it("現在の手番プレイヤーが一覧に無ければ例外を投げる", () => {
    expect(() => getNextPlayerId([player("a", 0)], "zzz")).toThrow(/存在しません/);
  });
});

describe("getNextPlayerIdAfterLeave", () => {
  it("離脱者より後ろの現役プレイヤーを選ぶ", () => {
    const players = [player("a", 0), player("b", 1, "2026-09-15T01:00:00.000Z"), player("c", 2)];
    expect(getNextPlayerIdAfterLeave(players, "b")).toBe("c");
  });

  it("離脱者が末尾なら先頭に戻る", () => {
    const players = [player("a", 0), player("b", 1), player("c", 2, "2026-09-15T01:00:00.000Z")];
    expect(getNextPlayerIdAfterLeave(players, "c")).toBe("a");
  });

  it("残りの現役プレイヤーがいなければ例外を投げる", () => {
    const players = [player("a", 0, "2026-09-15T01:00:00.000Z")];
    expect(() => getNextPlayerIdAfterLeave(players, "a")).toThrow(/参加者がいません/);
  });
});
