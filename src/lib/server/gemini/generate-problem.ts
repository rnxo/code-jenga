import "server-only";

// 担当: BE-B
// DB_DESIGN.md 5章-2: Gemini にプロンプトを投げてコード＋テストコードを取得する。
// 取得後は @/lib/server/repositories/problems の createProblem で保存し、
// @/lib/server/piston/run で事前検証してから is_verified=true にする（呼び出し側の責務）。

export interface GeneratedProblem {
  sourceCode: string;
  testCode: string;
  language: string;
}

export async function generateProblem(difficulty?: string): Promise<GeneratedProblem> {
  throw new Error(`未実装: generateProblem(${difficulty ?? "未指定"})`);
}
