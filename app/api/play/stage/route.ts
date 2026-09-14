// 舞台づくりをサーバー側で完結させるルート。
//
// クライアントが「生成を取った」（rooms.phase を seeding にできた）あとに叩く。
// ここから先はサーバーで走るので、呼んだタブが閉じられても最後まで進む。
//
// Supabase が設定されていないときは何もできない（localStorage はサーバーから
// 触れない）ので 501 を返し、呼び出し側がクライアント生成に落ちる。

import { createClient } from "@supabase/supabase-js";
import { generateStage } from "@/lib/gemini/stage";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  if (!url || !key) {
    return Response.json(
      { error: "Supabase が未設定のため、サーバー側では生成できません" },
      { status: 501 },
    );
  }

  let roomId = "";
  let playerCount = 2;

  try {
    const body = await request.json();
    roomId = String(body.roomId ?? "");
    playerCount = Number(body.playerCount) || 2;
  } catch {
    return Response.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  if (!roomId) {
    return Response.json({ error: "roomId が必要です" }, { status: 400 });
  }

  const supabase = createClient(url, key);

  // 呼び出し側がロックを取っている前提。取れていない部屋は触らない
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    return Response.json({ error: "部屋が見つかりません" }, { status: 404 });
  }
  if (room.phase !== "seeding") {
    return Response.json(
      { error: `この部屋はいま ${room.phase} なので生成しません` },
      { status: 409 },
    );
  }

  const result = await generateStage(playerCount);

  if (!("stage" in result)) {
    // 生成できなかったらロックを返して、誰かがやり直せるようにする
    await supabase
      .from("rooms")
      .update({ phase: "generating", seeding_started_at: null })
      .eq("id", roomId)
      .eq("phase", "seeding");

    return Response.json(
      { error: result.error, missingKey: result.missingKey },
      { status: result.missingKey ? 200 : 502 },
    );
  }

  const { stage } = result;

  // 前の一戦の残りを消してから並べ直す
  await supabase.from("jenga_blocks").delete().eq("room_id", roomId);

  const { error: seedError } = await supabase.from("jenga_blocks").insert(
    stage.lines.map((code_snippet, i) => ({
      room_id: roomId,
      block_index: i + 1,
      code_snippet,
    })),
  );

  if (seedError) {
    await supabase
      .from("rooms")
      .update({ phase: "generating", seeding_started_at: null })
      .eq("id", roomId)
      .eq("phase", "seeding");

    return Response.json(
      { error: `舞台を並べられませんでした: ${seedError.message}` },
      { status: 500 },
    );
  }

  const { error: beginError } = await supabase
    .from("rooms")
    .update({
      phase: "playing",
      seeding_started_at: null,
      stage_title: stage.title,
      judge_comment: stage.comment,
      turn_index: 0,
      last_output: null,
      verdict: null,
      loser_id: null,
    })
    .eq("id", roomId)
    .eq("phase", "seeding");

  if (beginError) {
    return Response.json(
      { error: `開始できませんでした: ${beginError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, title: stage.title, lines: stage.lines.length });
}
