// 担当: BE-B
// Piston 上で動くテストハーネスが stdout に出す結果マーカー。
//
// 言語ごとにハーネスの実装は分かれる（harness.ts = TypeScript / harness-python.ts = Python）が、
// マーカーの形式は全言語で共通にしている。こうしておくと classify.ts と parse-vitest.ts が
// 言語を知らないまま判定・集計でき、言語追加のたびに判定ロジックを増やさずに済む。
//
// 実体をこのファイルに置き、harness.ts は後方互換のため re-export する。
// 純粋モジュール（"server-only" を付けない）。

/** stdout の最終行に出す結果マーカー。以降は JSON `{ total, passed, failed, failures }`。 */
export const CJ_SUMMARY_MARKER = "__CJ_SUMMARY__";

/** ハーネス自身の障害（未対応マッチャーなど）。プレイヤーのアウトにしてはいけないので exit 0 で出す。 */
export const CJ_ERROR_MARKER = "__CJ_ERROR__";
