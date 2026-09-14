// 積み上がったコードを実行して、タワーが崩れる（＝エラーになる）かどうかを判定する。
// 公開 Piston API は 2026/2/15 から whitelist 制になったため、
// 自前ホストの Piston を使う場合のみ PISTON_URL を設定してください。
// 到達できない場合は fallback:true を返し、クライアント側の sandbox iframe で実行します。

const PISTON_URL =
  process.env.PISTON_URL || "https://emkc.org/api/v2/piston/execute";

export async function POST(request: Request) {
  let code = "";
  let language = "typescript";

  try {
    const body = await request.json();
    code = body.code ?? "";
    language = body.language ?? "typescript";
  } catch {
    return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  try {
    const res = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ name: "tower.ts", content: code }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json({
        fallback: true,
        error: `Piston API error: ${res.status}`,
        detail: detail.slice(0, 300),
      });
    }

    return Response.json(await res.json());
  } catch (error) {
    return Response.json({
      fallback: true,
      error:
        error instanceof Error ? error.message : "Piston への接続に失敗しました",
    });
  }
}
