export interface Block {
  id: string;
  code_snippet: string;
  player_name: string;
  block_index: number;
}

export type Verdict = "stable" | "wobbly" | "collapsed";

export interface GeminiMove {
  code: string;
  comment: string;
}

/** Gemini が積んだブロックの player_name。UI 側の出し分けにも使う */
export const GEMINI_PLAYER = "🤖 Gemini";

/** 1つのタワーを識別する ID。複数ゲームに分けるときはここを差し替える */
export const DEFAULT_GAME_ID = "00000000-0000-0000-0000-000000000000";
