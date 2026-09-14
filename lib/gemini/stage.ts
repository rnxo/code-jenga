// 舞台（お題コード）の生成。サーバー側からのみ呼ぶこと。
// /api/gemini（クライアント主導）と /api/play/stage（サーバー主導）の両方から
// 使うので、プロンプトと応答形の定義はここ1箇所に置く。

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeneratedStage {
  title: string;
  lines: string[];
  comment: string;
}

export const BUILD_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    lines: { type: "ARRAY", items: { type: "STRING" } },
    comment: { type: "STRING" },
  },
  required: ["title", "lines", "comment"],
};

export function buildStagePrompt(playerCount: number) {
  return `あなたは「Code Jenga」というゲームの出題者です。
プレイヤーは、あなたが作った JavaScript の関数 startJenga() の本体から
1行ずつ抜き取っていきます。抜いたあとに実行してエラーになったら「タワー崩壊」で、
抜いた人の負けです。

${playerCount} 人で遊ぶ舞台になるコードを作ってください。

条件:
- lines は 10〜14 個。各要素がちょうど1行ぶんの JavaScript（先頭は半角スペース2つでインデント）
- 全部そろっている状態では、必ずエラーなく最後まで実行され、console.log で何か出力されること
- if / for などの複数行にまたがるブロック文は使わず、1行で完結する文だけにすること
  （1行だけで閉じる形なら if (x) doSomething(); のように書いてよい）
- 抜いても平気な行（ログ出力など）と、抜くと即エラーになる行（あとで使う変数の宣言など）を
  半々くらいで混ぜること。どれが危ないか一目で分からないようにする
- 禁止: 無限ループ、1万回を超えるループ、while、fetch/XMLHttpRequest、import/require、
  eval、debugger、process や window への参照
- title は舞台の名前を日本語で短く（例:「発注書の集計」）
- comment はゲーム開始の実況を日本語で1〜2文。どこが危ういか匂わせる程度に`;
}

export type StageResult =
  | { stage: GeneratedStage }
  | { error: string; missingKey?: boolean };

/** Gemini に舞台を作らせる。鍵が無い・失敗した場合は error を返す */
export async function generateStage(playerCount: number): Promise<StageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      missingKey: true,
      error:
        "GEMINI_API_KEY が未設定です。.env.local に設定して dev サーバーを再起動してください。",
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: buildStagePrompt(playerCount) }] },
        ],
        generationConfig: {
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: BUILD_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      return { error: `Gemini API error: ${res.status}` };
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    const parsed = JSON.parse(text);
    const lines: string[] = Array.isArray(parsed.lines) ? parsed.lines : [];
    if (lines.length === 0) return { error: "Gemini が行を返しませんでした" };

    return {
      stage: {
        title: parsed.title ?? "名もなき舞台",
        lines,
        comment: parsed.comment ?? "",
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Gemini への接続に失敗しました",
    };
  }
}
