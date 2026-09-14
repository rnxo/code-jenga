// コード文字列に対する純粋関数群。
// FE / BE どちらからも import してよい（"server-only" な依存を持ち込まないこと）。

/** コードの行数を数える。空文字列は 0 行として扱う。 */
export function countLines(code: string): number {
  if (code === "") {
    return 0;
  }
  return code.split("\n").length;
}

/** 指定した行番号（1始まり）がコードの範囲内かどうかを判定する。 */
export function isDeletableLine(code: string, lineNo: number): boolean {
  const lineCount = countLines(code);
  return Number.isInteger(lineNo) && lineNo >= 1 && lineNo <= lineCount;
}

/** 指定した行（1始まり）を削除したコードと、削除された行の内容を返す。 */
export function deleteLine(
  code: string,
  lineNo: number,
): { codeAfter: string; deletedLineText: string } {
  if (!isDeletableLine(code, lineNo)) {
    throw new Error(
      `行番号 ${lineNo} は削除できません（現在の行数: ${countLines(code)}）。`,
    );
  }
  const lines = code.split("\n");
  const deletedLineText = lines[lineNo - 1];
  const codeAfter = lines.filter((_, index) => index !== lineNo - 1).join("\n");
  return { codeAfter, deletedLineText };
}

/** 空行・空白のみの行かどうかを判定する（DB_DESIGN.md 10章: 未決事項。UI 側の警告表示などに使う想定）。 */
export function isBlankLine(lineText: string): boolean {
  return lineText.trim().length === 0;
}
