// 担当: BE-B
// 対象コード＋テストコードを、Piston で実行できる1ファイルの Python に合成する。
//
// TypeScript 版（compose.ts）との違い:
// - import を全部消すことはできない。プレリュードで unittest を import しているので
//   `import unittest` は消しても動くが、`from typing import List` のような
//   標準ライブラリの import を消すと NameError になる。そこで許可リスト方式にする。
// - export 文が無いので stripExports 相当は不要。
// - Python はインデントに意味があるため、列0の import 行しか除去しない（後述）。
// - Gemini がほぼ確実に付けてくる `if __name__ == "__main__": unittest.main()` を除去する。
//   残るとエピローグの前にテストが走り、サマリ無しで SystemExit → classify が error になる。
//
// 除去した行は TypeScript 版と同じく「空行に置換」して行番号を保つ。
// 純粋モジュール（"server-only" を付けない）。

import type { ComposeInput, ComposedProgram } from "./compose";
import { stripCodeFence } from "./compose";
import { CJ_PY_HARNESS_EPILOGUE, CJ_PY_HARNESS_PRELUDE } from "./harness-python";

/**
 * Piston の python にはネットワークも pip も無い。標準ライブラリのうち、
 * お題で使われても安全なものだけを残す。
 *
 * sys は意図的に含めない。プレイヤーが sys.stdout や sys.exit を触るとハーネスが壊れるため、
 * 除去して NameError にし、failed 側へ倒す。
 */
const ALLOWED_MODULES = new Set([
  "unittest",
  "math",
  "re",
  "json",
  "typing",
  "collections",
  "itertools",
  "functools",
  "dataclasses",
  "datetime",
  "decimal",
  "fractions",
  "string",
  "enum",
  "abc",
  "heapq",
  "bisect",
  "copy",
  "operator",
  "statistics",
  "random",
]);

// 列0の import 行だけを対象にする（インデント付きは触らない。理由は stripPythonImports のコメント）。
const FROM_IMPORT = /^from\s+([A-Za-z0-9_.]+|\.+[A-Za-z0-9_.]*)\s+import\s+(.+)$/;
const PLAIN_IMPORT = /^import\s+(.+)$/;
const MAIN_GUARD = /^if\s+__name__\s*==\s*(['"])__main__\1\s*:\s*$/;
const UNITTEST_MAIN = /^unittest\s*\.\s*main\s*\(.*\)\s*$/;
/** 行が開いた括弧で終わる `from x import (` 形式か。 */
const OPEN_PAREN_TAIL = /\(\s*$/;
/** 行末のバックスラッシュ継続。 */
const LINE_CONTINUATION = /\\s*$/;

/** モジュール名（`a.b.c` や `.rel`）が許可リストに載っているか。相対 import は常に不許可。 */
function isAllowedModule(moduleName: string): boolean {
  if (moduleName.startsWith(".")) {
    return false;
  }
  const root = moduleName.split(".")[0];
  return ALLOWED_MODULES.has(root);
}

/**
 * import 文を許可リストに従って空行に置換する。
 *
 * インデント付きの import には触らない。`if cond:` の唯一の本体が import だった場合に
 * 空行へ置き換えると IndentationError になり、削除した行と無関係な理不尽なアウトになるため。
 * 残した場合は実行時 ModuleNotFoundError で該当テストだけ error になり、failed 側に正しく倒れる。
 */
export function stripPythonImports(code: string): { code: string; removed: string[] } {
  const removed: string[] = [];
  const out: string[] = [];
  const lines = code.split("\n");
  let skipUntil: "paren" | "continuation" | null = null;

  for (const line of lines) {
    if (skipUntil !== null) {
      removed.push(line);
      out.push("");
      if (skipUntil === "paren" ? line.includes(")") : !LINE_CONTINUATION.test(line)) {
        skipUntil = null;
      }
      continue;
    }

    // 列0の import 行のみ対象（先頭に空白がある行は素通し）。
    if (/^\s/.test(line)) {
      out.push(line);
      continue;
    }

    const fromMatch = FROM_IMPORT.exec(line);
    if (fromMatch) {
      const moduleName = fromMatch[1];
      // __future__ はファイル先頭でないと構文エラーになる。合成でプレリュードが前に付くので常に除去する。
      const keep = moduleName !== "__future__" && isAllowedModule(moduleName);
      if (keep) {
        out.push(line);
        if (OPEN_PAREN_TAIL.test(line) && !line.includes(")")) {
          // 残す側の括弧ブロックはそのまま通すので、追従は不要。
        }
        continue;
      }
      removed.push(line);
      out.push("");
      if (OPEN_PAREN_TAIL.test(line) && !line.includes(")")) {
        skipUntil = "paren";
      } else if (LINE_CONTINUATION.test(line)) {
        skipUntil = "continuation";
      }
      continue;
    }

    const plainMatch = PLAIN_IMPORT.exec(line);
    if (plainMatch) {
      const modules = plainMatch[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0].trim());
      // 混在（import math, solution）は部分書き換えせず行ごと除去する（字句解析はしない割り切り）。
      const keep = modules.length > 0 && modules.every((name) => isAllowedModule(name));
      if (keep) {
        out.push(line);
        continue;
      }
      removed.push(line);
      out.push("");
      if (LINE_CONTINUATION.test(line)) {
        skipUntil = "continuation";
      }
      continue;
    }

    out.push(line);
  }

  return { code: out.join("\n"), removed };
}

/**
 * `if __name__ == "__main__":` ブロックと、列0の `unittest.main()` 単独行を空行に置換する。
 * これらが残るとエピローグより先にテストが走り、サマリを出さないまま SystemExit で終わる。
 */
export function stripMainGuard(code: string): { code: string; removed: string[] } {
  const removed: string[] = [];
  const out: string[] = [];
  const lines = code.split("\n");
  let inGuard = false;

  for (const line of lines) {
    if (inGuard) {
      // ガード直下のインデント行と空行を食べ、列0の行が来たら抜ける。
      if (line.trim() === "" || /^\s/.test(line)) {
        removed.push(line);
        out.push("");
        continue;
      }
      inGuard = false;
    }
    if (MAIN_GUARD.test(line.trim()) && !/^\s/.test(line)) {
      removed.push(line);
      out.push("");
      inGuard = true;
      continue;
    }
    if (!/^\s/.test(line) && UNITTEST_MAIN.test(line.trim())) {
      removed.push(line);
      out.push("");
      continue;
    }
    out.push(line);
  }

  return { code: out.join("\n"), removed };
}

/** コードフェンス・import・__main__ ガードをまとめて除去する。 */
export function sanitizePython(code: string): { code: string; removed: string[] } {
  const imports = stripPythonImports(stripCodeFence(code));
  const guards = stripMainGuard(imports.code);
  return { code: guards.code, removed: [...imports.removed, ...guards.removed] };
}

/** プレリュード → 対象コード → テストコード → エピローグの順に合成する。 */
export function composePythonProgram(input: ComposeInput): ComposedProgram {
  const source = sanitizePython(input.sourceCode);
  const test = sanitizePython(input.testCode);
  const head = `${CJ_PY_HARNESS_PRELUDE}\n# ---- source ----\n`;
  // ブロックの途中で連結されると IndentationError になるため、境界には必ず改行を挟む。
  const program = `${head}${source.code}\n\n# ---- test ----\n${test.code}\n${CJ_PY_HARNESS_EPILOGUE}`;
  return {
    program,
    sourceStartLine: head.split("\n").length,
    removed: [...source.removed, ...test.removed],
  };
}
