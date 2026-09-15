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
  normal: ["comment", "symbol-only", "declaration", "expression"],
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

/**
 * その難易度で削除できる行番号（1始まり）の一覧。UI のグレーアウトや詰み判定に使う。
 * `safeLineTexts`（お題の事前検証で算出した「削除しても全テストが通る行」のテキスト一覧）を渡すと、
 * 削除可能かつセーフな行だけに絞る。null / undefined は「未算出」として絞り込みを行わない。
 */
export function listDeletableLineNumbers(
  code: string,
  difficulty: TurnDifficulty,
  language: CodeLanguage = DEFAULT_LANGUAGE,
  safeLineTexts?: readonly string[] | null,
): number[] {
  if (code === "") {
    return [];
  }
  const safeSet = safeLineTexts ? new Set(safeLineTexts) : null;
  const lines = code.split("\n");
  const lineNumbers: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isDeletableUnder(difficulty, line, language)) {
      continue;
    }
    if (safeSet !== null && !safeSet.has(line)) {
      continue;
    }
    lineNumbers.push(index + 1);
  }
  return lineNumbers;
}

/** その難易度で削除できる（safeLineTexts 指定時はセーフでもある）行が1行でもあるか（フォールバック判定用）。 */
export function hasDeletableLine(
  code: string,
  difficulty: TurnDifficulty,
  language: CodeLanguage = DEFAULT_LANGUAGE,
  safeLineTexts?: readonly string[] | null,
): boolean {
  return listDeletableLineNumbers(code, difficulty, language, safeLineTexts).length > 0;
}

const ROULETTE_DIFFICULTIES: readonly TurnDifficulty[] = ["easy", "normal", "hard"];

/** 格下げの順序（縛りの強い順）。抽選結果から始めて、成立する難易度まで順に下げる。 */
const DOWNGRADE_ORDER: readonly TurnDifficulty[] = ["hard", "normal", "easy"];

/**
 * EASY / NORMAL / HARD を均等確率で抽選し、その難易度で削除できる行が0行なら
 * HARD → NORMAL → EASY の順に段階的に格下げする。
 * `safeLineTexts` を渡すと「削除可能かつ削除してもテストが通る行」が残っている難易度まで下げる
 * （HARD で選べる宣言行はあるが全て重要行、というお題で HARD が強制アウトになるのを防ぐ）。
 * EASY でも該当行が無い場合は EASY を返す（残りは全て重要行で、誰かがアウトになって終わる）。
 * `random` はテストから抽選結果を固定するための注入口（デフォルトは Math.random）。
 * language / safeLineTexts は既存の呼び出しを壊さないよう末尾に置いている。
 */
export function rollTurnDifficulty(
  code: string,
  random: () => number = Math.random,
  language: CodeLanguage = DEFAULT_LANGUAGE,
  safeLineTexts?: readonly string[] | null,
): TurnDifficulty {
  const index = Math.floor(random() * ROULETTE_DIFFICULTIES.length);
  const rolled = ROULETTE_DIFFICULTIES[Math.min(index, ROULETTE_DIFFICULTIES.length - 1)];

  const startIndex = DOWNGRADE_ORDER.indexOf(rolled);
  for (let i = startIndex; i < DOWNGRADE_ORDER.length; i += 1) {
    if (hasDeletableLine(code, DOWNGRADE_ORDER[i], language, safeLineTexts)) {
      return DOWNGRADE_ORDER[i];
    }
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
  normal: "空行だけは削除できません。",
  hard: "宣言・制御（function / const / if / return など）を含む行しか削除できません。",
};
