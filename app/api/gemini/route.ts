// Gemini にゲームの舞台（タワーとなるコード）を作らせ（mode: "build"）、
// 抜いたあとの実行結果を講評させる（mode: "judge"）。
// API キーはこのサーバー側ルートから出さない。

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type BlockInput = { code_snippet: string; player_name: string };

const BUILD_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    lines: { type: "ARRAY", items: { type: "STRING" } },
    comment: { type: "STRING" },
  },
  required: ["title", "lines", "comment"],
};

const JUDGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["stable", "wobbly", "collapsed"] },
    comment: { type: "STRING" },
  },
  required: ["verdict", "comment"],
};

function buildPrompt(playerCount: number) {
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

  const isBuild = mode === "build";

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: isBuild
                  ? buildPrompt(playerCount)
                  : judgePrompt(blocks, output, removed),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: isBuild ? 1.0 : 0.4,
          responseMimeType: "application/json",
          responseSchema: isBuild ? BUILD_SCHEMA : JUDGE_SCHEMA,
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
