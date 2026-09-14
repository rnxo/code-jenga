import "server-only";

// 担当: BE-B
// Piston 経由で実行した Vitest の標準出力から、総数/成功/失敗のテスト数を抽出する。

export interface VitestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

/** Vitest の標準出力をパースする。パースできない形式であれば null を返す（呼び出し側は total_tests 等を NULL のまま保存する）。 */
export function parseVitestOutput(stdout: string): VitestSummary | null {
  throw new Error(`未実装: parseVitestOutput(stdout.length=${stdout.length})`);
}
