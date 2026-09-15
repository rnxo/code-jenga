// 担当: BE-B
// 言語ごとに変わるもの（Piston のランタイム名・送信ファイル名・合成関数・お題生成プロンプト）の型。
// 純粋モジュール（"server-only" を付けない）。

import type { CodeLanguage } from "@/types/game";
import type { ComposeInput, ComposedProgram } from "../compose";

/** Gemini プロンプトの言語ごとの差分。prompt.ts が難易度の行と組み合わせて1本の文字列にする。 */
export interface LanguagePromptSection {
  /** 「あなたはTypeScriptの教材コードを作る専門家です。」に相当する1行目。 */
  readonly roleLine: string;
  /** 言語・テストフレームワーク固有の指示行（この順序のまま結合する）。 */
  readonly rules: readonly string[];
}

export interface LanguageDefinition {
  readonly id: CodeLanguage;
  /** Piston の language フィールドに載せる値（typescript → "deno"）。 */
  readonly pistonLanguage: string;
  /** languageVersion が "" / "latest" のときに使う値。 */
  readonly defaultVersion: string;
  /** Piston へ送る files[0].name。 */
  readonly fileName: string;
  /** 環境変数の接尾辞（PISTON_LANGUAGE_PYTHON など）。大文字。 */
  readonly envSuffix: string;
  /** テストハーネスを使うか、testCode を期待標準出力として比較するか。 */
  readonly testStrategy: "harness" | "stdout";
  /** 対象コードとテストコードを1ファイルに合成する。 */
  readonly compose: (input: ComposeInput) => ComposedProgram;
  readonly prompt: LanguagePromptSection;
}
