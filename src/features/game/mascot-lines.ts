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
  | "sabotaged" // 相手に邪魔された（自分のタワーが回されている）
  | "sabotaging" // 相手を邪魔した（おせっかいくんを送り込んだ）
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
  sabotaged: [
    { message: "わー、相手に頼まれちゃった。ちょっと回すよ、ごめんね！", mood: "smug" },
    { message: "目が回る？ 落ち着いてからで大丈夫、時間は…減ってるけど。", mood: "panic" },
  ],
  sabotaging: [
    { message: "行ってきた！ 相手のタワー、いま絶賛ぐるぐる中。", mood: "smug" },
    { message: "ボクを使うなんて、いい性格してるね。褒めてるよ。", mood: "smug" },
  ],
};

/**
 * 煽り（毒舌）のセリフ。上の LINES に混ぜて使う。
 *
 * おせっかいくんは「おせっかい」なので、当たりが強いほど芝居として成立する。
 * ただし刺すのは**そのプレイと、AI が書いたコードだけ**にしてある。
 * 人となりや見た目の話には踏み込まない（遊んでいる本人が2人しかいない場で、
 * 笑えなくなった瞬間に台無しになるため）。
 *
 * 声は smug（低くゆっくり）が煽りに合うので、ほとんどを smug にしている。
 *
 * 強すぎると感じたら、下の LINES との合成をやめれば元の当たりに戻る。
 */
const TAUNT_LINES: Record<MascotSituation, MascotLine[]> = {
  my_turn: [
    { message: "また君の番か。さっきの手、正直ひどかったよ。", mood: "smug" },
    { message: "考えるフリはいいから、早く抜いてよ。", mood: "smug" },
  ],
  selected: [
    { message: "その行？ 本気？ ボクは何も言ってないからね。", mood: "smug" },
    { message: "いい度胸だね。実力じゃなくて度胸ね。", mood: "smug" },
    { message: "おー、そこ選ぶんだ。センスって教えられないんだなあ。", mood: "smug" },
  ],
  blocked: [
    { message: "ルールも読まずにコード消そうとしてる。すごいね、逆に。", mood: "smug" },
    { message: "はい違反。落ち着いて、深呼吸して、もう一回読もうか。", mood: "smug" },
  ],
  hurry: [
    { message: "まだ悩んでるの？ その時間で1本書けたよ。", mood: "panic" },
    { message: "時間切れで負けるの、いちばんダサいやつだからね！", mood: "panic" },
  ],
  waiting: [
    { message: "相手のほうが慎重だね。君と違って。", mood: "smug" },
    { message: "いま代わってあげようか？ ボクのほうが上手いと思う。", mood: "smug" },
  ],
  safe_mine: [
    { message: "生き残ったね。実力じゃなくて運だけど。", mood: "smug" },
    { message: "たまたまだよ、たまたま。次はないから。", mood: "smug" },
  ],
  safe_opponent: [
    { message: "相手は余裕だったね。さて、君の番だけど……がんばって。", mood: "smug" },
    { message: "ほら、ああいうのを上手いって言うんだよ。覚えとこうね。", mood: "smug" },
  ],
  idle: [
    { message: "静かだね。考えてる？ それとも固まってる？", mood: "smug" },
    { message: "そんなに悩む場面じゃないと思うんだけどなあ。", mood: "smug" },
    { message: "このコード、AI が書いたやつのほうが読みやすいね。", mood: "smug" },
  ],
  title: [
    { message: "来たね。前回の惨敗、まだ覚えてる？", mood: "smug" },
    { message: "今日は何回崩すつもり？ 一応数えておくね。", mood: "smug" },
  ],
  sabotaged: [
    { message: "回されてる間に選んだ行、あとで見返すと面白いよ。", mood: "smug" },
    { message: "ちゃんと読んでから抜いてね。読めないと思うけど。", mood: "smug" },
  ],
  sabotaging: [
    { message: "正面から勝てないときは、こういうのもアリだよね。", mood: "smug" },
    { message: "相手、いま画面に酔ってると思う。ナイス判断。", mood: "smug" },
  ],
};

/**
 * 実際に使う候補。ふつうのセリフに煽りを混ぜる。
 *
 * 混ぜるだけなので、当たりを元に戻したいときはこの合成をやめて
 * LINES をそのまま使えばよい。
 */
const ALL_LINES: Record<MascotSituation, MascotLine[]> = Object.fromEntries(
  (Object.keys(LINES) as MascotSituation[]).map((situation) => [
    situation,
    [...LINES[situation], ...TAUNT_LINES[situation]],
  ]),
) as Record<MascotSituation, MascotLine[]>;

/** 状況に合うセリフを1つ選ぶ。直前と同じセリフは避ける（候補が1つしかない場合を除く）。 */
export function pickMascotLine(situation: MascotSituation, previous: string | null = null): MascotLine {
  const candidates = ALL_LINES[situation].filter((line) => line.message !== previous);
  const pool = candidates.length > 0 ? candidates : ALL_LINES[situation];
  return pool[Math.floor(Math.random() * pool.length)];
}
