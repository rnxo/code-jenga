/** 画面遷移。①スタート → ②部屋作成/参加 → ③待機 → ④コード → ⑤終了 */
export type Screen = "start" | "create" | "join" | "lobby" | "game" | "result";

/** 部屋の進行状態。全端末で共有され、これが screen を決める */
export type RoomPhase = "lobby" | "playing" | "finished";

export interface Room {
  id: string;
  /** 合言葉。参加はこの文字列だけで行う（秘匿情報ではない） */
  password: string;
  host_id: string;
  phase: RoomPhase;
  /** 崩した人の player_id。決着前は null */
  loser_id: string | null;
  /** 全員で共有する最後の実行結果 */
  last_output: string | null;
  /** 全員で共有する Gemini の判定 */
  verdict: Verdict | null;
  /** 全員で共有する Gemini の講評 */
  judge_comment: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  is_ready: boolean;
  created_at: string;
}

export interface Block {
  id: string;
  room_id: string;
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

/** ホストを含めた1部屋の上限人数 */
export const MAX_PLAYERS = 4;
