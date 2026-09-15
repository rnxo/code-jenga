import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Game } from "@/types/game";
import { TurnIndicator } from "./TurnIndicator";

afterEach(() => {
  cleanup();
});

function buildGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-1",
    room_id: "room-1",
    round_no: 1,
    problem_id: "problem-1",
    status: "playing",
    language: "typescript",
    turn_no: 3,
    current_player_id: "player-1",
    current_turn_difficulty: null,
    turn_time_limit_seconds: 60,
    turn_deadline_at: new Date(Date.now() + 30_000).toISOString(),
    current_code: "const x = 1;",
    current_line_count: 1,
    loser_id: null,
    finish_reason: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("TurnIndicator", () => {
  it("難易度が null のときはバッジを表示しない", () => {
    render(<TurnIndicator game={buildGame({ current_turn_difficulty: null })} isMyTurn={true} />);
    expect(screen.queryByText("EASY")).toBeNull();
    expect(screen.queryByText("NORMAL")).toBeNull();
    expect(screen.queryByText("HARD")).toBeNull();
  });

  it("EASY のときバッジと縛りの説明を表示する", () => {
    render(<TurnIndicator game={buildGame({ current_turn_difficulty: "easy" })} isMyTurn={true} />);
    expect(screen.queryByText("EASY")).not.toBeNull();
    expect(screen.queryByText("どの行でも削除できます。")).not.toBeNull();
  });

  it("NORMAL のときバッジと縛りの説明を表示する", () => {
    render(<TurnIndicator game={buildGame({ current_turn_difficulty: "normal" })} isMyTurn={false} />);
    expect(screen.queryByText("NORMAL")).not.toBeNull();
    expect(screen.queryByText("空行だけは削除できません。")).not.toBeNull();
  });

  it("HARD のときバッジと縛りの説明を表示する", () => {
    render(<TurnIndicator game={buildGame({ current_turn_difficulty: "hard" })} isMyTurn={false} />);
    expect(screen.queryByText("HARD")).not.toBeNull();
    expect(
      screen.queryByText("宣言・制御（function / const / if / return など）を含む行しか削除できません。"),
    ).not.toBeNull();
  });
});
