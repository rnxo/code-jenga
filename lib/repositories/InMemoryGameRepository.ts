import type { Game } from "@/lib/game/types";
import type { GameRepository } from "@/lib/repositories/GameRepository";
const games = new Map<string, Game>();
export class InMemoryGameRepository implements GameRepository {
  create(playerNames: string[]): Game { const players = playerNames.map((name, index) => ({ id: `player-${index + 1}`, name })); const game: Game = { id: `demo-game-${Date.now()}`, players, code: "", language: "javascript", currentPlayerId: players[0].id, status: "playing", lastTestResult: null }; games.set(game.id, game); return game; }
  get(gameId: string) { return games.get(gameId); }
  save(game: Game) { games.set(game.id, game); }
}
export const gameRepository = new InMemoryGameRepository();