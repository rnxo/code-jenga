// Gemini をゲーム内のプレイヤー（mode: "move"）兼・審判（mode: "judge"）として動かす。
// API キーはこのサーバー側ルートから出さない。

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type BlockInput = { code_snippet: string; player_name: string };

const MOVE_SCHEMA = {
  type: "OBJECT",
  properties: {
    code: { type: "STRING" },
    comment: { type: "STRING" },
  },
  required: ["code", "comment"],
};

const JUDGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["stable", "wobbly", "collapsed"] },
    comment: { type: "STRING" },
  },
  required: ["verdict", "comment"],
};

function towerText(blocks: BlockInput[]) {
  if (blocks.length === 0) return "(まだ1ブロックもありません)";
  return blocks
    .map((b, i) => `${i + 1}. ${b.code_snippet}   // by ${b.player_name}`)
    .join("\n");
}

function buildPrompt(mode: "move" | "judge", blocks: BlockInput[], output: string) {
  if (mode === "move") {
    return `あなたは「Code Jenga」というゲームの対戦AIプレイヤーです。
プレイヤーたちは JavaScript の関数 startJenga() の本体に1行ずつコードを積み上げ、
実行してエラーになったら「タワー崩壊」で負けです。

現在のタワー（上から順に実行されます）:
${towerText(blocks)}

あなたの手番です。次に積む「1行」を考えてください。

ルール:
- 出力する code は必ず JavaScript として構文的に正しい1行にすること（先頭は半角スペース2つでインデント）
- 実行してもエラーにならないこと。ただし後続のプレイヤーが積みにくくなるような、少しトリッキーな行だと良い
- 禁止: 無限ループ、1万回を超えるループ、while(true)、fetch/XMLHttpRequest、import/require、eval、debugger、process や window への書き込み
- console.log で状況を実況するのは歓迎
- comment には、その一手の狙いを日本語で1〜2文、対戦相手を煽るくらいの調子で書くこと`;
  }

  return `あなたは「Code Jenga」というゲームの審判AIです。
プレイヤーたちが積み上げた JavaScript のタワーと、その実行結果を見て判定してください。

タワー:
${towerText(blocks)}

実行結果:
${output || "(実行結果なし)"}

判定基準:
- stable: エラーも無く、まだ余裕がある
- wobbly: 動いてはいるが、次の一手で崩れそうな危うさがある
- collapsed: エラーが出ている、または実質的に破綻している

comment には、日本語で2〜3文の実況・講評を書いてください。どのブロックが効いているかに触れると良いです。`;
}

// 鍵が設定されているかどうかだけを返す（鍵そのものは返さない）
export async function GET() {
  return Response.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: MODEL,
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({
      missingKey: true,
      error:
        "GEMINI_API_KEY が未設定です。.env.local に設定して dev サーバーを再起動してください。",
    });
  }

  let mode: "move" | "judge" = "move";
  let blocks: BlockInput[] = [];
  let output = "";

  try {
    const body = await request.json();
    mode = body.mode === "judge" ? "judge" : "move";
    blocks = Array.isArray(body.blocks) ? body.blocks.slice(0, 100) : [];
    output = typeof body.output === "string" ? body.output.slice(0, 4000) : "";
  } catch {
    return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
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
          { role: "user", parts: [{ text: buildPrompt(mode, blocks, output) }] },
        ],
        generationConfig: {
          temperature: mode === "move" ? 1.0 : 0.4,
          responseMimeType: "application/json",
          responseSchema: mode === "move" ? MOVE_SCHEMA : JUDGE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(30_000),
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
