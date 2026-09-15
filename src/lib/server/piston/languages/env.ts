// 担当: BE-B
// Piston に渡す言語・バージョンの環境変数による上書きを解決する。
//
// 言語を増やす前からある PISTON_LANGUAGE / PISTON_LANGUAGE_VERSION は .env.example にも
// 各自の .env.local にも Vercel にも "deno" / "*" として設定されている。これを全言語に
// 適用すると Python のお題まで deno に送られて必ず失敗するため、旧変数は typescript 専用として扱う。
// 言語ごとの上書きが要る場合は PISTON_LANGUAGE_PYTHON / PISTON_LANGUAGE_VERSION_PYTHON を使う。
// 純粋モジュール（"server-only" を付けない）。

import type { LanguageDefinition } from "./types";

/** 環境変数の読み取り元。テストから差し替えられるよう、process.env より緩い型で受ける。 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** 環境変数の値を trim し、空文字なら undefined にする。 */
function readEnv(source: EnvSource, name: string): string | undefined {
  return source[name]?.trim() || undefined;
}

/** Piston に送るランタイム名の上書きを解決する。未設定なら undefined（言語定義の既定値を使う）。 */
export function resolvePistonLanguageOverride(
  definition: LanguageDefinition,
  source: EnvSource = process.env,
): string | undefined {
  const specific = readEnv(source, `PISTON_LANGUAGE_${definition.envSuffix}`);
  if (specific) {
    return specific;
  }
  // 後方互換: 旧 PISTON_LANGUAGE は typescript にのみ効かせる。
  return definition.id === "typescript" ? readEnv(source, "PISTON_LANGUAGE") : undefined;
}

/** Piston に送るバージョンの上書きを解決する。未設定なら undefined。 */
export function resolvePistonVersionOverride(
  definition: LanguageDefinition,
  source: EnvSource = process.env,
): string | undefined {
  const specific = readEnv(source, `PISTON_LANGUAGE_VERSION_${definition.envSuffix}`);
  if (specific) {
    return specific;
  }
  return definition.id === "typescript" ? readEnv(source, "PISTON_LANGUAGE_VERSION") : undefined;
}
