// ランダム難易度ルーレット（ターンごとの削除制限）に関する純粋関数群。
// FE / BE どちらからも import してよい（"server-only" な依存を持ち込まないこと）。
//
// 実際に採用される抽選はサーバー側（src/lib/server/game 配下）の呼び出しのみ。
// クライアントやモックがここを呼んでも盤面には反映されず、Realtime で届く
// サーバー側の値に必ず上書きされる（DB_DESIGN.md 1章: 書き込みはサーバーに一元化）。
//
// 割り切り: 字句解析はせず、行単位の文字列パターンのみで分類する
// （対象は Gemini が生成する小規模なコードのため）。
// ブロックコメント（/* ... */）内部で `*` から始まらない継続行はコメントと
// 判定できず expression 扱いになるが、削除してもテストは通る側に倒れるため
// ゲームとしては安全側の誤判定になる（DB_DESIGN.md 10章参照）。
//
// 言語ごとにコメント記法と宣言キーワードが違うので、言語を任意の末尾引数で受け取る。
// 既定は "typescript" なので、言語を渡さない既存の呼び出しは挙動が変わらない。

import type { CodeLanguage, TurnDifficulty } from "@/types/game";
import { DEFAULT_LANGUAGE } from "./language";
import { isBlankLine } from "./code";

export type LineKind = "blank" | "comment" | "symbol-only" | "declaration" | "expression";

const TYPESCRIPT_DECLARATION_KEYWORDS = [
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

const PYTHON_DECLARATION_KEYWORDS = [
  "import",
  "from",
  "def",
  "class",
  "lambda",
  "return",
  "yield",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "with",
  "try",
  "except",
  "finally",
  "raise",
  "assert",
  "global",
  "nonlocal",
  "del",
  "pass",
  "break",
  "continue",
] as const;

interface LanguageLineRules {
  /** 行頭がこれらのいずれかで始まればコメント行とみなす。 */
  readonly commentPrefixes: readonly string[];
  /** 宣言・制御構文の判定に使うキーワード。 */
  readonly declarationPattern: RegExp;
  /** 記号だけの行（閉じ括弧など）の判定。 */
  readonly symbolOnlyPattern: RegExp;
}

function toKeywordPattern(keywords: readonly string[]): RegExp {
  return new RegExp(`\\b(${keywords.join("|")})\\b`);
}

const LINE_RULES: Record<CodeLanguage, LanguageLineRules> = {
  typescript: {
    commentPrefixes: ["//", "/*", "*"],
    declarationPattern: toKeywordPattern(TYPESCRIPT_DECLARATION_KEYWORDS),
    symbolOnlyPattern: /^[{}()[\];,]+$/,
  },
  python: {
    commentPrefixes: ["#"],
    declarationPattern: toKeywordPattern(PYTHON_DECLARATION_KEYWORDS),
    // Python では閉じ括弧だけの行はほとんど出ないが、複数行リテラルの終端で現れる。
    symbolOnlyPattern: /^[)\]},]+$/,
  },
};

/** 行テキストを分類する（行単位のパターンマッチのみ）。 */
export function classifyLine(lineText: string, language: CodeLanguage = DEFAULT_LANGUAGE): LineKind {
  const trimmed = lineText.trim();
  const rules = LINE_RULES[language];

  if (isBlankLine(lineText)) {
    return "blank";
  }
  if (rules.commentPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return "comment";
  }
  if (rules.symbolOnlyPattern.test(trimmed)) {
    return "symbol-only";
  }
  if (rules.declarationPattern.test(trimmed)) {
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
export function isDeletableUnder(
  difficulty: TurnDifficulty,
  lineText: string,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): boolean {
  const kind = classifyLine(lineText, language);
  return DELETABLE_KINDS[difficulty].includes(kind);
}

/** その難易度で削除できる行番号（1始まり）の一覧。UI のグレーアウトや詰み判定に使う。 */
export function listDeletableLineNumbers(
  code: string,
  difficulty: TurnDifficulty,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): number[] {
  if (code === "") {
    return [];
  }
  const lines = code.split("\n");
  const lineNumbers: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isDeletableUnder(difficulty, lines[index], language)) {
      lineNumbers.push(index + 1);
    }
  }
  return lineNumbers;
}

/** その難易度で削除できる行が1行でもあるか（フォールバック判定用）。 */
export function hasDeletableLine(
  code: string,
  difficulty: TurnDifficulty,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): boolean {
  return listDeletableLineNumbers(code, difficulty, language).length > 0;
}

const ROULETTE_DIFFICULTIES: readonly TurnDifficulty[] = ["easy", "normal", "hard"];

/**
 * EASY / NORMAL / HARD を均等確率で抽選し、削除可能行が0行なら EASY にフォールバックする。
 * `random` はテストから抽選結果を固定するための注入口（デフォルトは Math.random）。
 * language は既存の呼び出しを壊さないよう末尾に置いている。
 */
export function rollTurnDifficulty(
  code: string,
  random: () => number = Math.random,
  language: CodeLanguage = DEFAULT_LANGUAGE,
): TurnDifficulty {
  const index = Math.floor(random() * ROULETTE_DIFFICULTIES.length);
  const rolled = ROULETTE_DIFFICULTIES[Math.min(index, ROULETTE_DIFFICULTIES.length - 1)];

  if (hasDeletableLine(code, rolled, language)) {
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
