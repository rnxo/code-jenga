// 担当: BE-B
// 対象コード＋テストコードを、Piston で実行できる1ファイルの TypeScript に合成する。
//
// Piston のサンドボックスでは `import { describe } from "vitest"` も `import { sum } from "./sum"` も
// 解決できない（npm 無し・tsc ランタイムはファイル名に .ts を追記するため相対 import が壊れる）。
// そこで import / export を行単位で除去し、プレリュード（harness.ts）→ 対象コード → テストコード →
// エピローグの順に連結する。除去した行は「空行に置換」して行番号を保つ。
//
// 割り切り（difficulty.ts と同じく字句解析はしない）:
// - import は「行頭が import で始まる行」および「import { … 改行 … } from "…"」ブロックのみ対応。
// - 対象コードとテストコードで同名のトップレベル宣言があると実行時エラーになる。その場合は
//   非ゼロ終了 → failed（アウト）に倒れるので、ゲームとしては安全側。
// 純粋モジュール（"server-only" を付けない）。

import { CJ_HARNESS_EPILOGUE, CJ_HARNESS_PRELUDE } from "./harness";

export interface ComposeInput {
  sourceCode: string;
  testCode: string;
}

export interface ComposedProgram {
  program: string;
  /** 対象コードが始まる行番号（1始まり）。stderr の行番号を対象コードへ読み替えるため。 */
  sourceStartLine: number;
  /** 除去した import / export 文の記録（握りつぶさず呼び出し側で参照できるようにする）。 */
  removed: string[];
}

const IMPORT_SINGLE_LINE = /^\s*import\s[^;]*?["'][^"']+["']\s*;?\s*$/;
const IMPORT_BLOCK_START = /^\s*import\s+(?:type\s+)?\{[^}]*$/;
const IMPORT_BLOCK_END = /\}\s*from\s*["'][^"']+["']\s*;?\s*$/;
const EXPORT_STATEMENT =
  /^\s*export\s*(?:\{[^}]*\}\s*(?:from\s*["'][^"']+["'])?|\*\s*(?:as\s+\w+\s+)?from\s*["'][^"']+["'])\s*;?\s*$/;
const EXPORT_DEFAULT_DECL = /^(\s*)export\s+default\s+(?=(?:async\s+)?function\b|class\b)/;
const EXPORT_DEFAULT_EXPR = /^(\s*)export\s+default\s+/;
const EXPORT_DECL =
  /^(\s*)export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b|type\b|interface\b|enum\b|abstract\b|declare\b)/;
const CODE_FENCE = /^\s*```[\w-]*\s*$/;

/** Markdown のコードフェンス行を取り除く（Gemini が稀に混入させる）。 */
export function stripCodeFence(code: string): string {
  return code
    .split("\n")
    .filter((line) => !CODE_FENCE.test(line))
    .join("\n");
}

/** import 文を空行に置換する。 */
export function stripImports(code: string): { code: string; removed: string[] } {
  const removed: string[] = [];
  const out: string[] = [];
  let inBlock = false;
  for (const line of code.split("\n")) {
    if (inBlock) {
      removed.push(line);
      out.push("");
      if (IMPORT_BLOCK_END.test(line)) inBlock = false;
      continue;
    }
    if (IMPORT_SINGLE_LINE.test(line)) {
      removed.push(line);
      out.push("");
      continue;
    }
    if (IMPORT_BLOCK_START.test(line)) {
      inBlock = true;
      removed.push(line);
      out.push("");
      continue;
    }
    out.push(line);
  }
  return { code: out.join("\n"), removed };
}

/** export キーワードを取り除く（宣言は残し、re-export 文は空行にする）。 */
export function stripExports(code: string): { code: string; removed: string[] } {
  const removed: string[] = [];
  const out = code.split("\n").map((line) => {
    if (EXPORT_STATEMENT.test(line)) {
      removed.push(line);
      return "";
    }
    if (EXPORT_DEFAULT_DECL.test(line)) {
      removed.push(line);
      return line.replace(EXPORT_DEFAULT_DECL, "$1");
    }
    if (EXPORT_DEFAULT_EXPR.test(line)) {
      removed.push(line);
      return line.replace(EXPORT_DEFAULT_EXPR, "$1const __cjDefault = ");
    }
    if (EXPORT_DECL.test(line)) {
      removed.push(line);
      return line.replace(EXPORT_DECL, "$1");
    }
    return line;
  });
  return { code: out.join("\n"), removed };
}

/** import / export / コードフェンスをまとめて除去する。 */
export function sanitize(code: string): { code: string; removed: string[] } {
  const imports = stripImports(stripCodeFence(code));
  const exports = stripExports(imports.code);
  return { code: exports.code, removed: [...imports.removed, ...exports.removed] };
}

/** プレリュード → 対象コード → テストコード → エピローグの順に合成する。 */
export function composeProgram(input: ComposeInput): ComposedProgram {
  const source = sanitize(input.sourceCode);
  const test = sanitize(input.testCode);
  const head = `${CJ_HARNESS_PRELUDE}\n// ---- source ----\n`;
  const program = `${head}${source.code}\n// ---- test ----\n${test.code}\n${CJ_HARNESS_EPILOGUE}`;
  return {
    program,
    sourceStartLine: head.split("\n").length,
    removed: [...source.removed, ...test.removed],
  };
}

/**
 * 既に「対象コード + 改行 + テストコード」に連結された文字列から合成する。
 * apply-turn.ts は連結済みの code を渡してくるため、そのまま受けられるようにしている
 * （除去は行単位なので連結済みでも同じ結果になる）。
 */
export function composeFromConcatenated(code: string): ComposedProgram {
  return composeProgram({ sourceCode: code, testCode: "" });
}
