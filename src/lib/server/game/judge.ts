import "server-only";

import type { TestRunStatus, TurnResult } from "@/types/game";

// 担当: BE-A
// test_run_status → turn_result への変換ルール（DB_DESIGN.md 3章の補足）。
//
// 重要: test_run_status = 'error'（Piston 呼び出し自体の失敗）は turn_result = 'out' に
// 変換してはいけない。呼び出し側はこの場合ターンをアウト扱いにせず、リトライ or
// TEST_RUN_ERROR としてクライアントへエラーメッセージを返すこと。

export type TurnJudgement =
  | { judged: true; result: TurnResult }
  | { judged: false; reason: string };

/** テスト実行結果（test_run_status）から1手の判定結果を決める。 */
export function judgeTurnResult(testRunStatus: TestRunStatus): TurnJudgement {
  throw new Error(`未実装: judgeTurnResult(${testRunStatus})`);
}
