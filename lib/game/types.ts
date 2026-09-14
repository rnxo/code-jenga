export type Player = { id: string; name: string };
export type GameStatus = "waiting" | "playing" | "finished";
export type TestResult = "SAFE" | "LOSE" | null;
export type Game = { id: string; players: Player[]; code: string; language: string; testCode?: string; currentPlayerId: string; status: GameStatus; lastTestResult: TestResult; loserPlayerId?: string; pendingPlayerId?: string; pendingLineIndex?: number; pendingLineWasBlank?: boolean };
export type GeneratedCode = { code: string; language: string; testCode: string };
export type GameView = Pick<Game, "id" | "players" | "code" | "language" | "currentPlayerId" | "status" | "lastTestResult" | "loserPlayerId" | "pendingPlayerId" | "pendingLineIndex">;
export type CreateGameResponse = Pick<Game, "id" | "players" | "currentPlayerId" | "status"> & { gameId: string };