import type { Game } from "@/lib/game/types";
export interface GameRepository { create(playerNames: string[]): Game; get(gameId: string): Game | undefined; save(game: Game): void; }