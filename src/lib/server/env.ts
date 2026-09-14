import "server-only";

// Route Handler / lib/server 配下から使うサーバー専用の環境変数をまとめて検証する。
// 未設定の場合は「握りつぶさず、意味のあるメッセージ付きで処理する」（CLAUDE.md）方針に従い、
// どの変数が足りないかを明示して例外を投げる。

const REQUIRED_SERVER_ENV_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "PISTON_API_URL",
] as const;

type ServerEnvVarName = (typeof REQUIRED_SERVER_ENV_VARS)[number];

export type ServerEnv = Record<ServerEnvVarName, string>;

/** 必須のサーバー環境変数を検証して返す。1つでも欠けていれば例外を投げる。 */
export function getServerEnv(): ServerEnv {
  const missing: ServerEnvVarName[] = [];
  const values = {} as ServerEnv;

  for (const name of REQUIRED_SERVER_ENV_VARS) {
    const value = process.env[name];
    if (!value) {
      missing.push(name);
    } else {
      values[name] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `必須の環境変数が未設定です: ${missing.join(", ")}。.env.local を確認してください（.env.example 参照）。`,
    );
  }

  return values;
}
