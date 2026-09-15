// 担当: BE-B
// Piston 経由で実行したテストの標準出力から、総数/成功/失敗のテスト数を抽出する。
//
// 実体は harness.ts のマーカー行（`__CJ_SUMMARY__{"total":..}`）のパース。Piston 上では
// Vitest 本体が動かないため、本物の Vitest テキスト形式（`Tests  2 passed | 1 failed (3)`）は
// 将来ローカルで Vitest を直接走らせる場合の保険としてのみ対応する。
//
// 重要: この関数は絶対に throw しない。apply-turn.ts が try/catch なしで呼んでおり、
// ここで例外が出ると test_runs の保存前にターンが消失する。
// 純粋モジュール（"server-only" を付けない）。

import { CJ_SUMMARY_MARKER } from "./harness";

export interface VitestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

const VITEST_TEXT_SUMMARY = /^\s*Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed(?:\s*\|\s*\d+\s+skipped)?\s*\((\d+)\)/m;

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseMarkerLine(line: string): VitestSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line.slice(CJ_SUMMARY_MARKER.length));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (!isNonNegativeInteger(record.total) || !isNonNegativeInteger(record.passed) || !isNonNegativeInteger(record.failed)) {
    return null;
  }
  return { totalTests: record.total, passedTests: record.passed, failedTests: record.failed };
}

/** テストの標準出力をパースする。パースできない形式であれば null を返す（呼び出し側は total_tests 等を NULL のまま保存する）。 */
export function parseVitestOutput(stdout: string): VitestSummary | null {
  const lines = stdout.split("\n");
  // ユーザーコードが同じ文字列を出力した場合に備え、末尾側のマーカーを優先する。
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].startsWith(CJ_SUMMARY_MARKER)) {
      return parseMarkerLine(lines[index]);
    }
  }
  const match = VITEST_TEXT_SUMMARY.exec(stdout);
  if (match) {
    const failed = Number(match[1] ?? "0");
    const passed = Number(match[2]);
    const total = Number(match[3]);
    if ([failed, passed, total].every(isNonNegativeInteger)) {
      return { totalTests: total, passedTests: passed, failedTests: failed };
    }
  }
  return null;
}

/** ハーネスを持たない言語の標準出力を、既存のテスト集計形式へ変換する。 */
export function parseTestOutput(stdout: string, language: string, expectedOutput: string): VitestSummary | null {
  if (language.trim().toLowerCase() !== "brainfuck") {
    return parseVitestOutput(stdout);
  }
  const actual = stdout.replace(/\r\n/g, "\n");
  const expected = expectedOutput.replace(/\r\n/g, "\n");
  return actual === expected
    ? { totalTests: 1, passedTests: 1, failedTests: 0 }
    : { totalTests: 1, passedTests: 0, failedTests: 1 };
}
