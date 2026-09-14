// ランダム難易度ルーレット（ターンごとの削除制限）に関する純粋関数群。
// FE / BE どちらからも import してよい（"server-only" な依存を持ち込まないこと）。
//
// 実際に採用される抽選はサーバー側（src/lib/server/game 配下）の呼び出しのみ。
// クライアントやモックがここを呼んでも盤面には反映されず、Realtime で届く
// サーバー側の値に必ず上書きされる（DB_DESIGN.md 1章: 書き込みはサーバーに一元化）。
//
// 割り切り: 字句解析はせず、行単位の文字列パターンのみで分類する
// （対象は Gemini が生成する小規模な TypeScript コードのため）。
// ブロックコメント（/* ... */）内部で `*` から始まらない継続行はコメントと
// 判定できず expression 扱いになるが、削除してもテストは通る側に倒れるため
// ゲームとしては安全側の誤判定になる（DB_DESIGN.md 10章参照）。

import type { TurnDifficulty } from "@/types/game";
import { isBlankLine } from "./code";

export type LineKind = "blank" | "comment" | "symbol-only" | "declaration" | "expression";

const DECLARATION_KEYWORDS = [
  "import",
  "export",
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "const",
  "let",
  "var",
  "return",
  "if",
  "else",
  "for",
  "while",
  "switch",
  "case",
  "do",
  "try",
  "catch",
  "finally",
  "throw",
] as const;

const DECLARATION_KEYWORD_PATTERN = new RegExp(
  `\\b(${DECLARATION_KEYWORDS.join("|")})\\b`,
);

const SYMBOL_ONLY_PATTERN = /^[{}()[\];,]+$/;

/** 行テキストを分類する（TypeScript 想定・行単位のパターンマッチのみ）。 */
export function classifyLine(lineText: string): LineKind {
  const trimmed = lineText.trim();

  if (isBlankLine(lineText)) {
    return "blank";
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return "comment";
  }
  if (SYMBOL_ONLY_PATTERN.test(trimmed)) {
    return "symbol-only";
  }
  if (DECLARATION_KEYWORD_PATTERN.test(trimmed)) {
    return "declaration";
  }
  return "expression";
}

/** 難易度ごとに削除を許可する行種別（EASY ⊇ NORMAL ⊇ HARD の単調な包含関係）。 */
const DELETABLE_KINDS: Record<TurnDifficulty, readonly LineKind[]> = {
  easy: ["blank", "comment", "symbol-only", "declaration", "expression"],
  normal: ["declaration", "expression"],
  hard: ["declaration"],
};

/** その難易度でこの行を削除してよいか。 */
export function isDeletableUnder(difficulty: TurnDifficulty, lineText: string): boolean {
  const kind = classifyLine(lineText);
  return DELETABLE_KINDS[difficulty].includes(kind);
}

/** その難易度で削除できる行番号（1始まり）の一覧。UI のグレーアウトや詰み判定に使う。 */
export function listDeletableLineNumbers(code: string, difficulty: TurnDifficulty): number[] {
  if (code === "") {
    return [];
  }
  const lines = code.split("\n");
  const lineNumbers: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isDeletableUnder(difficulty, lines[index])) {
      lineNumbers.push(index + 1);
    }
  }
  return lineNumbers;
}

/** その難易度で削除できる行が1行でもあるか（フォールバック判定用）。 */
export function hasDeletableLine(code: string, difficulty: TurnDifficulty): boolean {
  return listDeletableLineNumbers(code, difficulty).length > 0;
}

const ROULETTE_DIFFICULTIES: readonly TurnDifficulty[] = ["easy", "normal", "hard"];

/**
 * EASY / NORMAL / HARD を均等確率で抽選し、削除可能行が0行なら EASY にフォールバックする。
 * `random` はテストから抽選結果を固定するための注入口（デフォルトは Math.random）。
 */
export function rollTurnDifficulty(code: string, random: () => number = Math.random): TurnDifficulty {
  const index = Math.floor(random() * ROULETTE_DIFFICULTIES.length);
  const rolled = ROULETTE_DIFFICULTIES[Math.min(index, ROULETTE_DIFFICULTIES.length - 1)];

  if (hasDeletableLine(code, rolled)) {
    return rolled;
  }
  return "easy";
}

/** UI 表示用ラベル（英語表記）。 */
export const DIFFICULTY_LABEL: Record<TurnDifficulty, string> = {
  easy: "EASY",
  normal: "NORMAL",
  hard: "HARD",
};

/** UI 表示用の縛りの説明文（日本語）。 */
export const DIFFICULTY_RULE_TEXT: Record<TurnDifficulty, string> = {
  easy: "どの行でも削除できます。",
  normal: "空行・コメント行・記号だけの行は削除できません。",
  hard: "宣言・制御（function / const / if / return など）を含む行しか削除できません。",
};
