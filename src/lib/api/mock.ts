// フロント単体開発用のモック API 実装。
// NEXT_PUBLIC_USE_MOCK_API=true のとき src/lib/api/client.ts から呼ばれる。
// バックエンドの Route Handler が未完成でも、画面の見た目と型の整合を確認できる。
// 担当: FE-A / FE-B（画面に合わせて自由に拡張してよい）。
//
// /rooms/[code] の画面もモックできる（page.tsx / useLobbyRealtime / useGameRealtime から参照）。
// Realtime は無いので固定データ。ルームコードで見たい画面を切り替える:
//   MOCK01: ロビー（waiting）   MOCK02: 盤面（playing・自分の手番）   MOCK03: 結果（finished）

import type {
  ApiResult,
  CreateProblemRequest,
  CreateProblemResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  CreateTurnRequest,
  CreateTurnResponse,
  GetGameResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  LeaveGameResponse,
  RematchGameResponse,
  StartGameRequest,
  StartGameResponse,
  TimeoutTurnResponse,
  UpdateGameLanguageRequest,
  UpdateGameLanguageResponse,
} from "@/types/api";
import type { Game, GamePlayer, Problem, Room, Turn } from "@/types/game";
import { rollTurnDifficulty } from "@/lib/shared/difficulty";

const MOCK_HOST_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_GUEST_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_ROOM_ID = "10000000-0000-4000-8000-000000000001";
const MOCK_GAME_ID = "20000000-0000-4000-8000-000000000001";
const MOCK_BOARD_GAME_ID = "20000000-0000-4000-8000-000000000002";
const MOCK_RESULT_GAME_ID = "20000000-0000-4000-8000-000000000003";
const MOCK_PROBLEM_ID = "30000000-0000-4000-8000-000000000001";

const SAMPLE_SOURCE = [
  "function sum(numbers: number[]): number {",
  "  let total = 0;",
  "  for (const n of numbers) {",
  "    total += n;",
  "  }",
  "  return total;",
  "}",
].join("\n");

const SAMPLE_TEST = [
  'import { describe, expect, it } from "vitest";',
  'import { sum } from "./sum";',
  "",
  'describe("sum", () => {',
  '  it("合計を返す", () => {',
  "    expect(sum([1, 2, 3])).toBe(6);",
  "  });",
  "});",
].join("\n");

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function mockProblem(): Problem {
  return {
    id: MOCK_PROBLEM_ID,
    source_code: SAMPLE_SOURCE,
    test_code: SAMPLE_TEST,
    language: "typescript",
    initial_line_count: SAMPLE_SOURCE.split("\n").length,
    generated_by: "seed",
    generation_prompt: null,
    difficulty: "easy",
    is_verified: true,
    safe_line_texts: null,
    created_at: nowIso(),
  };
}

function mockRoom(): Room {
  return {
    id: MOCK_ROOM_ID,
    code: "MOCK01",
    host_id: MOCK_HOST_ID,
    status: "waiting",
    max_players: 4,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function mockGame(overrides: Partial<Game> = {}): Game {
  const problem = mockProblem();
  return {
    id: MOCK_GAME_ID,
    room_id: MOCK_ROOM_ID,
    round_no: 1,
    problem_id: problem.id,
    status: "playing",
    language: "typescript",
    turn_no: 1,
    current_player_id: MOCK_HOST_ID,
    current_turn_difficulty: rollTurnDifficulty(problem.source_code),
    turn_time_limit_seconds: 60,
    turn_deadline_at: new Date(Date.now() + 60_000).toISOString(),
    current_code: problem.source_code,
    current_line_count: problem.initial_line_count,
    loser_id: null,
    finish_reason: null,
    started_at: nowIso(),
    finished_at: null,
    created_at: nowIso(),
    ...overrides,
  };
}

function mockPlayers(): GamePlayer[] {
  return [
    {
      game_id: MOCK_GAME_ID,
      player_id: MOCK_HOST_ID,
      turn_order: 0,
      is_ready: true,
      joined_at: nowIso(),
      left_at: null,
    },
    {
      game_id: MOCK_GAME_ID,
      player_id: MOCK_GUEST_ID,
      turn_order: 1,
      is_ready: true,
      joined_at: nowIso(),
      left_at: null,
    },
  ];
}

const MOCK_NICKNAME_BY_ID = new Map<string, string>([
  [MOCK_HOST_ID, "モックホスト"],
  [MOCK_GUEST_ID, "モックゲスト"],
]);

/** ルームコードごとの固定状態。見たい画面に合わせてコードを打ち分ける。 */
const MOCK_GAME_BY_CODE: Record<string, () => Game> = {
  MOCK01: () =>
    mockGame({
      status: "waiting",
      current_player_id: null,
      current_turn_difficulty: null,
      current_code: null,
      current_line_count: null,
      turn_no: 0,
      started_at: null,
    }),
  // ゲストが1手目（2行目）を抜いてセーフになった直後の、自分の手番。getTurnsByGameId と対応させる。
  MOCK02: () => {
    const codeAfter = SAMPLE_SOURCE.split("\n")
      .filter((_, index) => index !== 1)
      .join("\n");
    return mockGame({
      id: MOCK_BOARD_GAME_ID,
      turn_no: 1,
      current_code: codeAfter,
      current_line_count: codeAfter.split("\n").length,
      current_turn_difficulty: rollTurnDifficulty(codeAfter),
    });
  },
  MOCK03: () =>
    mockGame({
      id: MOCK_RESULT_GAME_ID,
      status: "finished",
      loser_id: MOCK_GUEST_ID,
      finish_reason: "test_failed",
      finished_at: nowIso(),
    }),
};

export interface MockRoomPageData {
  /** 閲覧者。常にホストとして扱う（盤面では自分の手番になる） */
  userId: string;
  room: Room;
  game: Game;
  players: GamePlayer[];
  nicknameById: Map<string, string>;
}

/** /rooms/[code] の Server Component が Supabase の代わりに読む。未知のコードは null（404）。 */
export function getRoomPageData(code: string): MockRoomPageData | null {
  const buildGame = MOCK_GAME_BY_CODE[code];
  if (!buildGame) {
    return null;
  }
  const game = buildGame();
  return {
    userId: MOCK_HOST_ID,
    room: { ...mockRoom(), code, status: game.status === "playing" ? "playing" : "waiting" },
    game,
    players: mockPlayers().map((player) => ({ ...player, game_id: game.id })),
    nicknameById: MOCK_NICKNAME_BY_ID,
  };
}

/** useGameRealtime / useLobbyRealtime が Supabase の代わりに読む。 */
export function getGameById(gameId: string): Game | null {
  const game = Object.values(MOCK_GAME_BY_CODE)
    .map((build) => build())
    .find((candidate) => candidate.id === gameId);
  return game ?? null;
}

export function getPlayersByGameId(gameId: string): GamePlayer[] {
  return mockPlayers().map((player) => ({ ...player, game_id: gameId }));
}

/** 盤面（MOCK02）には「ゲストが2行目を抜いてセーフ」の1手を入れておき、TestResultPanel が見えるようにする。 */
export function getTurnsByGameId(gameId: string): Turn[] {
  if (gameId !== MOCK_BOARD_GAME_ID) {
    return [];
  }
  const lines = SAMPLE_SOURCE.split("\n");
  return [
    {
      id: "mock-turn-0",
      game_id: gameId,
      turn_no: 0,
      player_id: MOCK_GUEST_ID,
      deleted_line_no: 2,
      deleted_line_text: lines[1] ?? "",
      code_before: SAMPLE_SOURCE,
      code_after: lines.filter((_, index) => index !== 1).join("\n"),
      turn_difficulty: "easy",
      result: "safe",
      test_run_id: null,
      duration_ms: 1200,
      created_at: nowIso(),
    },
  ];
}

export async function createRoom(_req: CreateRoomRequest): Promise<ApiResult<CreateRoomResponse>> {
  return ok({
    room: mockRoom(),
    game: mockGame({
      status: "waiting",
      current_player_id: null,
      current_turn_difficulty: null,
      current_code: null,
      current_line_count: null,
      turn_no: 0,
    }),
  });
}

export async function joinRoom(
  _code: string,
  _req: JoinRoomRequest,
): Promise<ApiResult<JoinRoomResponse>> {
  return ok({ gameId: MOCK_GAME_ID });
}

export async function startGame(
  _gameId: string,
  _req: StartGameRequest,
): Promise<ApiResult<StartGameResponse>> {
  return ok({ game: mockGame() });
}

// モックは Realtime が無いので、返した game を LobbyPanel 側で state に反映して見た目を切り替える。
export async function updateGameLanguage(
  gameId: string,
  req: UpdateGameLanguageRequest,
): Promise<ApiResult<UpdateGameLanguageResponse>> {
  return ok({ game: mockGame({ id: gameId, status: "waiting", language: req.language }) });
}

export async function createTurn(
  gameId: string,
  req: CreateTurnRequest,
): Promise<ApiResult<CreateTurnResponse>> {
  const game = mockGame();
  const lines = (game.current_code ?? "").split("\n");
  const deletedLine = lines[req.lineNo - 1] ?? "";
  const codeAfter = lines.filter((_, index) => index !== req.lineNo - 1).join("\n");

  const turn: Turn = {
    id: `mock-turn-${req.lineNo}`,
    game_id: gameId,
    turn_no: game.turn_no,
    player_id: game.current_player_id ?? MOCK_HOST_ID,
    deleted_line_no: req.lineNo,
    deleted_line_text: deletedLine,
    code_before: game.current_code ?? "",
    code_after: codeAfter,
    turn_difficulty: game.current_turn_difficulty ?? "easy",
    result: "safe",
    test_run_id: null,
    duration_ms: 1200,
    created_at: nowIso(),
  };

  return ok({
    turn,
    game: mockGame({
      current_code: codeAfter,
      current_line_count: (game.current_line_count ?? 1) - 1,
      turn_no: game.turn_no + 1,
      current_player_id: MOCK_GUEST_ID,
      // 次のターンの縛りを、削除後のコードに対して引き直す（ランダム難易度ルーレット）。
      current_turn_difficulty: rollTurnDifficulty(codeAfter),
    }),
  });
}

export async function getGame(gameId: string): Promise<ApiResult<GetGameResponse>> {
  return ok({ game: mockGame({ id: gameId }), players: mockPlayers(), turns: [] });
}

export async function createProblem(
  _req: CreateProblemRequest,
): Promise<ApiResult<CreateProblemResponse>> {
  return ok({ problem: mockProblem() });
}

export async function timeoutTurn(gameId: string): Promise<ApiResult<TimeoutTurnResponse>> {
  return ok({
    game: mockGame({
      id: gameId,
      status: "finished",
      current_player_id: null,
      turn_deadline_at: null,
      loser_id: MOCK_HOST_ID,
      finish_reason: "timeout",
      finished_at: nowIso(),
    }),
    applied: true,
  });
}

export async function leaveGame(gameId: string): Promise<ApiResult<LeaveGameResponse>> {
  // モックは2人対戦のため、離脱すると残り1人になり中断（aborted）扱いになる。
  return ok({
    game: mockGame({
      id: gameId,
      status: "aborted",
      current_player_id: null,
      turn_deadline_at: null,
      finish_reason: "aborted",
      finished_at: nowIso(),
    }),
  });
}

export async function rematchGame(_gameId: string): Promise<ApiResult<RematchGameResponse>> {
  const nextGameId = "20000000-0000-4000-8000-000000000002";
  return ok({
    game: mockGame({
      id: nextGameId,
      round_no: 2,
      status: "waiting",
      problem_id: null,
      turn_no: 0,
      current_player_id: null,
      current_turn_difficulty: null,
      turn_deadline_at: null,
      current_code: null,
      current_line_count: null,
      started_at: null,
    }),
    players: mockPlayers().map((player) => ({ ...player, game_id: nextGameId, is_ready: false })),
  });
}
