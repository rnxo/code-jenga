// マスコット（カイル風）のセリフ表。担当: FE-B
// 盤面の状況ごとに候補を持ち、pickMascotLine で1つ選ぶ。ゲーム進行には一切関与しない。

export type MascotSituation =
  | "my_turn" // 自分の手番が来た
  | "selected" // 行を選んだ
  | "blocked" // 縛りで削除できない行を選んだ
  | "hurry" // 残り時間わずか（自分の手番）
  | "waiting" // 相手の手番を待っている
  | "safe_mine" // 自分の手がセーフだった（相手の手番に移った直後）
  | "safe_opponent" // 相手の手がセーフだった（自分の手番が来た直後）
  | "idle" // しばらく何も起きていない
  | "title"; // タイトル画面（試合の外）

export type MascotMood = "idle" | "smug" | "panic";

export interface MascotLine {
  message: string;
  mood: MascotMood;
}

const LINES: Record<MascotSituation, MascotLine[]> = {
  my_turn: [
    { message: "お、君の番だね。どの行を抜く？", mood: "idle" },
    { message: "焦らなくていいよ。時間はあるし…たぶん。", mood: "smug" },
    { message: "ヒント: 「return」は抜かない方がいいと思うな。", mood: "smug" },
  ],
  selected: [
    { message: "その行、本当に大丈夫？消したら動かなくなりそうだけど…", mood: "smug" },
    { message: "ふーん、そこ抜くんだ。ボクなら…いや、何でもない。", mood: "smug" },
    { message: "テストが泣いてる気がする。気のせいかな。", mood: "idle" },
  ],
  blocked: [
    { message: "それはこの縛りでは抜けないよ。ルール読んだ？", mood: "smug" },
    { message: "残念、そこは今回ナシ。別の行にしよう。", mood: "idle" },
  ],
  hurry: [
    { message: "急いで急いで！時間ないよ！", mood: "panic" },
    { message: "え、まだ決めてないの？やばいって！", mood: "panic" },
    { message: "残り数秒！適当でいいから押して！…いや良くないけど！", mood: "panic" },
  ],
  waiting: [
    { message: "相手が考え中。ヒマだね。", mood: "idle" },
    { message: "相手、めっちゃ悩んでるよ。プレッシャーかけとく？", mood: "smug" },
    { message: "コーヒーでも飲んでくれば？…あ、戻ってこないと負けだけど。", mood: "idle" },
  ],
  safe_mine: [
    { message: "ふーん、生き残ったね。運がいい。", mood: "smug" },
    { message: "セーフ！…テストがザルなだけかもしれないけど。", mood: "smug" },
  ],
  safe_opponent: [
    { message: "相手はセーフだったよ。残念でした。", mood: "smug" },
    { message: "相手、うまいね。君は大丈夫？", mood: "idle" },
  ],
  title: [
    { message: "やあ、ボクはおせっかいくん。今日は誰のコードが崩れるかな？", mood: "idle" },
    { message: "ルールは簡単。1行抜いて、テストが通ればセーフ。通らなかったら…ね。", mood: "smug" },
    { message: "友だち呼んできた？ひとりだと遊べないよ。", mood: "idle" },
  ],
  idle: [
    { message: "ボクの名前？まだ無いんだ。付けてよ。", mood: "idle" },
    { message: "このコード、AI が書いたらしいよ。責任は取らないって。", mood: "idle" },
    { message: "ジェンガって、最後に崩した人が負けなんだよね。知ってた？", mood: "smug" },
    { message: "……。", mood: "idle" },
  ],
};

/** 状況に合うセリフを1つ選ぶ。直前と同じセリフは避ける（候補が1つしかない場合を除く）。 */
export function pickMascotLine(situation: MascotSituation, previous: string | null = null): MascotLine {
  const candidates = LINES[situation].filter((line) => line.message !== previous);
  const pool = candidates.length > 0 ? candidates : LINES[situation];
  return pool[Math.floor(Math.random() * pool.length)];
}
