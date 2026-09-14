// Gemini にゲームの舞台（タワーとなるコード）を作らせ（mode: "build"）、
// 抜いたあとの実行結果を講評させる（mode: "judge"）。
// API キーはこのサーバー側ルートから出さない。

import { GEMINI_MODEL, generateStage } from "@/lib/gemini/stage";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type BlockInput = { code_snippet: string; player_name: string };

const JUDGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["stable", "wobbly", "collapsed"] },
    comment: { type: "STRING" },
  },
  required: ["verdict", "comment"],
};

function judgePrompt(blocks: BlockInput[], output: string, removed: string) {
  const tower =
    blocks.length > 0
      ? blocks.map((b, i) => `${i + 1}. ${b.code_snippet}`).join("\n")
      : "(空になりました)";

  return `あなたは「Code Jenga」というゲームの審判AIです。
プレイヤーがタワー（JavaScript のコード）から1行抜きました。

抜かれた行:
${removed || "(不明)"}

残ったタワー:
${tower}

実行結果:
${output || "(実行結果なし)"}

判定基準:
- stable: エラーも無く、まだ余裕がある
- wobbly: 動いてはいるが、次の一手で崩れそうな危うさがある
- collapsed: エラーが出ている、または実質的に破綻している

comment には、日本語で2〜3文の実況・講評を書いてください。
次に抜くと危なそうな行に触れると盛り上がります。`;
}

// 鍵が設定されているかどうかだけを返す（鍵そのものは返さない）
export async function GET() {
  return Response.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
}

export async function POST(request: Request) {
  let mode: "build" | "judge" = "build";
  let blocks: BlockInput[] = [];
  let output = "";
  let removed = "";
  let playerCount = 2;

  try {
    const body = await request.json();
    mode = body.mode === "judge" ? "judge" : "build";
    blocks = Array.isArray(body.blocks) ? body.blocks.slice(0, 100) : [];
    output = typeof body.output === "string" ? body.output.slice(0, 4000) : "";
    removed = typeof body.removed === "string" ? body.removed.slice(0, 500) : "";
    playerCount = Number(body.playerCount) || 2;
  } catch {
    return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  // 舞台づくりは /api/play/stage と同じ実装を使う
  if (mode === "build") {
    const result = await generateStage(playerCount);
    return "stage" in result
      ? Response.json({ mode, ...result.stage })
      : Response.json({ mode, error: result.error, missingKey: result.missingKey });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({
      missingKey: true,
      error:
        "GEMINI_API_KEY が未設定です。.env.local に設定して dev サーバーを再起動してください。",
    });
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: judgePrompt(blocks, output, removed) }] },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: JUDGE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json({
        error: `Gemini API error: ${res.status}`,
        detail: detail.slice(0, 300),
      });
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    try {
      return Response.json({ mode, ...JSON.parse(text) });
    } catch {
      return Response.json({
        error: "Gemini の応答を解釈できませんでした",
        raw: text.slice(0, 300),
      });
    }
  } catch (error) {
    return Response.json({
      error:
        error instanceof Error ? error.message : "Gemini への接続に失敗しました",
    });
  }
}
