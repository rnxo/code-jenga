import "server-only";

import { deleteLine, isBlankLine } from "@/lib/shared/code";
import { parseVitestOutput } from "./parse-vitest";
import { runOnPiston } from "./run";

// お題の「セーフ行」（削除しても全テストが通る行）を Piston で総当たりして算出する。
// 結果は problems.safe_line_texts に保存し、ターン難易度の抽選（src/lib/shared/difficulty.ts の
// rollTurnDifficulty）で「その難易度で選べる行のうち消しても落ちない行が残っているか」の判定に使う。
//
// 割り切り: 判定は「初期コードから1行だけ消した」状態で行う。複数行削除後に冗長行同士の関係で
// 結果が変わるケース（二重ガードの片方が消えた後など）はカバーしない。
// Piston 呼び出し自体の失敗（PistonError）は握りつぶさず呼び出し側へ投げる。

export interface ComputeSafeLinesInput {
  sourceCode: string;
  testCode: string;
  language: string;
}

export interface ComputeSafeLinesResult {
  /** 削除しても全テストが通る行のテキスト（重複除去済み、空行を含む）。 */
  safeLineTexts: string[];
  /** 空行を除いたセーフ行の数（ゲームとして成立するかの判定に使う）。 */
  nonBlankSafeLineCount: number;
  /** 実際に Piston を実行した回数（空行はスキップするため行数より少ない）。 */
  pistonRuns: number;
}

/** 同時に Piston へ投げる本数。Piston 側は PISTON_MAX_CONCURRENT_JOBS=64 だが、1 台構成なので控えめにする。 */
export const SAFE_LINE_CONCURRENCY = 4;

export async function computeSafeLines(input: ComputeSafeLinesInput): Promise<ComputeSafeLinesResult> {
  if (input.sourceCode === "") {
    return { safeLineTexts: [], nonBlankSafeLineCount: 0, pistonRuns: 0 };
  }
  const lines = input.sourceCode.split("\n");
  const safeFlags: boolean[] = new Array<boolean>(lines.length).fill(false);
  let pistonRuns = 0;

  // 空行は削除しても構文・意味に影響しないので Piston を叩かずにセーフ扱いにする。
  const targets: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isBlankLine(lines[index])) {
      safeFlags[index] = true;
    } else {
      targets.push(index);
    }
  }

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < targets.length) {
      const index = targets[cursor];
      cursor += 1;
      const { codeAfter } = deleteLine(input.sourceCode, index + 1);
      const result = await runOnPiston({
        language: input.language,
        languageVersion: "*",
        code: `${codeAfter}\n\n${input.testCode}`,
        sourceCode: codeAfter,
        testCode: input.testCode,
      });
      pistonRuns += 1;
      const summary = parseVitestOutput(result.stdout);
      safeFlags[index] =
        result.outcome === "passed" && summary !== null && summary.totalTests > 0 && summary.failedTests === 0;
    }
  };
  await Promise.all(Array.from({ length: Math.min(SAFE_LINE_CONCURRENCY, targets.length) }, () => worker()));

  const safeLineTexts = new Set<string>();
  let nonBlankSafeLineCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!safeFlags[index]) {
      continue;
    }
    safeLineTexts.add(lines[index]);
    if (!isBlankLine(lines[index])) {
      nonBlankSafeLineCount += 1;
    }
  }
  return { safeLineTexts: [...safeLineTexts], nonBlankSafeLineCount, pistonRuns };
}
