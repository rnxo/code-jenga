import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// リポジトリ層と Piston 実行はモックし、applyTurn の分岐だけを検証する（backend-todo 6-1）。
vi.mock("@/lib/server/repositories/games", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/repositories/games")>();
  return {
    ...actual,
    findGameById: vi.fn(),
    applyTurnTransaction: vi.fn(),
  };
});
vi.mock("@/lib/server/repositories/game-players", () => ({ listGamePlayers: vi.fn() }));
vi.mock("@/lib/server/repositories/problems", () => ({ findProblemById: vi.fn() }));
vi.mock("@/lib/server/piston/run", () => ({ runOnPiston: vi.fn() }));

import type { Game, GamePlayer, Problem, Turn } from "@/types/game";
import { ApplicationError } from "@/lib/api/errors";
import { applyTurnTransaction, findGameById, GameRpcError } from "@/lib/server/repositories/games";
import { listGamePlayers } from "@/lib/server/repositories/game-players";
import { findProblemById } from "@/lib/server/repositories/problems";
import { PistonError } from "@/lib/server/piston/errors";
import { runOnPiston, type PistonRunResult } from "@/lib/server/piston/run";
import { applyTurn } from "./apply-turn";

const GAME_ID = "game-1";
const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

// 1行目: 宣言（hard でも削除可）、2行目: 式（normal まで）、3行目: 空行（easy のみ）
const CODE = ["const answer = 42;", "console.log(answer);", ""].join("\n");

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: GAME_ID,
    room_id: "room-1",
    round_no: 1,
    status: "playing",
    problem_id: "problem-1",
    current_code: CODE,
    current_line_count: 3,
    current_player_id: PLAYER_A,
    current_turn_difficulty: "easy",
    turn_no: 3,
    turn_time_limit_seconds: 60,
    turn_deadline_at: null,
    started_at: "2026-09-15T00:00:00.000Z",
    finished_at: null,
    finish_reason: null,
    loser_id: null,
    created_at: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

function player(playerId: string, turnOrder: number): GamePlayer {
  return {
    game_id: GAME_ID,
    player_id: playerId,
    turn_order: turnOrder,
    is_ready: false,
    joined_at: "2026-09-15T00:00:00.000Z",
    left_at: null,
  };
}

function problem(): Problem {
  return {
    id: "problem-1",
    language: "typescript",
    source_code: CODE,
    test_code: "test();",
    initial_line_count: 3,
    difficulty: null,
    generated_by: "seed",
    generation_prompt: null,
    is_verified: true,
    created_at: "2026-09-15T00:00:00.000Z",
  };
}

function pistonResult(overrides: Partial<PistonRunResult> = {}): PistonRunResult {
  return {
    outcome: "passed",
    exitCode: 0,
    stdout: "",
    stderr: "",
    compileOutput: null,
    raw: null,
    executedCode: "",
    resolvedLanguage: "typescript",
    resolvedVersion: "1.0.0",
    errorMessage: null,
    ...overrides,
  };
}

/** promise が ApplicationError(code) で reject されることを検証し、そのエラーを返す。 */
async function expectApplicationError(promise: Promise<unknown>, code: string): Promise<ApplicationError> {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught, "エラーが投げられませんでした").not.toBeNull();
  expect(caught).toBeInstanceOf(ApplicationError);
  const error = caught as ApplicationError;
  expect(error.code).toBe(code);
  return error;
}

function turnInput(playerId: string, lineNo: number) {
  return { gameId: GAME_ID, playerId, lineNo };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(findGameById).mockResolvedValue(game());
  vi.mocked(listGamePlayers).mockResolvedValue([player(PLAYER_A, 0), player(PLAYER_B, 1)]);
  vi.mocked(findProblemById).mockResolvedValue(problem());
  vi.mocked(runOnPiston).mockResolvedValue(pistonResult());
  vi.mocked(applyTurnTransaction).mockImplementation(async (input) => ({
    turn: { id: "turn-1", game_id: GAME_ID, turn_no: input.expectedTurnNo + 1 } as Turn,
    game: game({ turn_no: input.expectedTurnNo + 1, current_player_id: input.nextPlayerId }),
  }));
});

describe("applyTurn: 事前検証", () => {
  it("試合が無ければ GAME_NOT_FOUND", async () => {
    vi.mocked(findGameById).mockResolvedValue(null);
    await expectApplicationError(applyTurn(turnInput(PLAYER_A, 1)), "GAME_NOT_FOUND");
  });

  it("playing 以外なら GAME_NOT_PLAYING", async () => {
    vi.mocked(findGameById).mockResolvedValue(game({ status: "finished" }));
    await expectApplicationError(applyTurn(turnInput(PLAYER_A, 1)), "GAME_NOT_PLAYING");
  });

  it("手番でないプレイヤーは NOT_YOUR_TURN（Piston は呼ばない）", async () => {
    await expectApplicationError(applyTurn(turnInput(PLAYER_B, 1)), "NOT_YOUR_TURN");
    expect(runOnPiston).not.toHaveBeenCalled();
  });

  it("範囲外の行番号は INVALID_LINE", async () => {
    await expectApplicationError(applyTurn(turnInput(PLAYER_A, 99)), "INVALID_LINE");
  });

  it("難易度 hard で式の行を消そうとすると LINE_NOT_DELETABLE", async () => {
    vi.mocked(findGameById).mockResolvedValue(game({ current_turn_difficulty: "hard" }));
    const error = await expectApplicationError(applyTurn(turnInput(PLAYER_A, 2)), "LINE_NOT_DELETABLE");
    expect(error.message).toContain("HARD");
    expect(runOnPiston).not.toHaveBeenCalled();
  });
});

describe("applyTurn: 判定と確定", () => {
  it("テスト成功なら safe で次のプレイヤーに手番を渡す", async () => {
    const result = await applyTurn(turnInput(PLAYER_A, 3));

    expect(applyTurnTransaction).toHaveBeenCalledTimes(1);
    const input = vi.mocked(applyTurnTransaction).mock.calls[0][0];
    expect(input).toMatchObject({
      expectedTurnNo: 3,
      deletedLineNo: 3,
      turnResult: "safe",
      nextPlayerId: PLAYER_B,
      finishReason: null,
      testRun: { status: "passed" },
    });
    expect(input.nextTurnDifficulty).not.toBeNull();
    expect(result.game.current_player_id).toBe(PLAYER_B);
  });

  it("テスト失敗なら out で test_failed 終了にする", async () => {
    vi.mocked(runOnPiston).mockResolvedValue(pistonResult({ outcome: "failed", exitCode: 1 }));
    await applyTurn(turnInput(PLAYER_A, 2));

    expect(vi.mocked(applyTurnTransaction).mock.calls[0][0]).toMatchObject({
      turnResult: "out",
      nextPlayerId: null,
      nextTurnDifficulty: null,
      finishReason: "test_failed",
      testRun: { status: "failed" },
    });
  });

  it("最後の1行を消してテストが通ったら no_lines_left 終了にする", async () => {
    vi.mocked(findGameById).mockResolvedValue(game({ current_code: "const answer = 42;", current_line_count: 1 }));
    await applyTurn(turnInput(PLAYER_A, 1));

    expect(vi.mocked(applyTurnTransaction).mock.calls[0][0]).toMatchObject({
      turnResult: "safe",
      nextPlayerId: null,
      finishReason: "no_lines_left",
    });
  });
});

describe("applyTurn: TEST_RUN_ERROR（手番は消費しない）", () => {
  it("Piston 呼び出しが失敗したら TEST_RUN_ERROR を返し DB には書かない", async () => {
    vi.mocked(runOnPiston).mockRejectedValue(new PistonError("timeout", "Piston がタイムアウトしました"));
    const error = await expectApplicationError(applyTurn(turnInput(PLAYER_A, 1)), "TEST_RUN_ERROR");
    expect(error.message).toContain("もう一度送信");
    expect(applyTurnTransaction).not.toHaveBeenCalled();
  });

  it("判定不能（outcome=error）はアウト扱いにせず TEST_RUN_ERROR にする", async () => {
    vi.mocked(runOnPiston).mockResolvedValue(
      pistonResult({ outcome: "error", exitCode: null, errorMessage: "ハーネスが出力しませんでした" }),
    );
    const error = await expectApplicationError(applyTurn(turnInput(PLAYER_A, 1)), "TEST_RUN_ERROR");
    expect(error.message).toContain("ハーネスが出力しませんでした");
    expect(applyTurnTransaction).not.toHaveBeenCalled();
  });
});

describe("applyTurn: RPC エラーの変換", () => {
  it("RPC の NOT_YOUR_TURN（二重送信）は ApplicationError に変換する", async () => {
    vi.mocked(applyTurnTransaction).mockRejectedValue(new GameRpcError("NOT_YOUR_TURN", "手番が進んでいます"));
    await expectApplicationError(applyTurn(turnInput(PLAYER_A, 1)), "NOT_YOUR_TURN");
  });

  it("未知の RPC エラーはそのまま投げる", async () => {
    vi.mocked(applyTurnTransaction).mockRejectedValue(new GameRpcError("SOMETHING_ELSE", "不明"));
    await expect(applyTurn(turnInput(PLAYER_A, 1))).rejects.toBeInstanceOf(GameRpcError);
  });
});
