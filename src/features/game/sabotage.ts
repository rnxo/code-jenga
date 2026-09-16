// 妨害（おせっかいくんがタワーを回す）の純ロジック。担当: FE-B
//
// 待っている側が「邪魔する」を押すと、手番側の画面でおせっかいくんが走ってきて
// タワーをぐるっと一回転させる。勝敗には一切関与しない見せ場で、
// 同期は Supabase Realtime の Broadcast（DB に残さない）で行う。
//
// ここには React も Supabase も置かず、テストできる計算だけを集める。

/** タワーが一回転して元に戻るまでの時間 */
export const SPIN_DURATION_MS = 2500;
/** キャラが走ってきて去るまで。回転より少し長い（登場 → 回す → 退場） */
export const SABOTAGE_SCENE_MS = 3200;
/** 一回転に足す「勢い」の上限（度）。seed でばらつかせる */
export const SPIN_OVERSHOOT_DEG = 30;

/** Broadcast チャンネルの名前。試合ごとに分ける（game:${id} とは別名にする） */
export function sabotageChannelName(gameId: string): string {
  return `game:${gameId}:sabotage`;
}

/** Broadcast の event 名 */
export const SABOTAGE_EVENT = "spin";

/** 相手へ送る中身 */
export interface SabotagePayload {
  senderId: string;
  /** 0〜1。回す方向と勢いを決める。受信側で同じ絵になるよう送信側が決める */
  seed: number;
}

/** 受信した unknown が SabotagePayload の形をしているか */
export function isSabotagePayload(value: unknown): value is SabotagePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.senderId === "string" &&
    record.senderId.length > 0 &&
    typeof record.seed === "number" &&
    Number.isFinite(record.seed) &&
    record.seed >= 0 &&
    record.seed <= 1
  );
}

/** 画面で進行中の妨害。id は受けるたびに増え、同じ seed でも別の演出として扱う */
export interface SabotageIncident {
  id: number;
  seed: number;
  /** 自分が仕掛けた側か（セリフの出し分けに使う） */
  byMe: boolean;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 経過時間 t（ms）でタワーに足す回転角（度）。
 *
 * 0 から始まり、途中で 360°（＋seed による勢い）まで回り、
 * SPIN_DURATION_MS で 0 に戻る。360° の倍数で終わるので、戻ったときに
 * ユーザーのドラッグ角度（--ry）と食い違わない。
 * seed < 0.5 なら逆回りにする。
 */
export function spinAngleAt(t: number, seed: number): number {
  if (t <= 0) {
    return 0;
  }
  if (t >= SPIN_DURATION_MS) {
    return 0;
  }
  const progress = t / SPIN_DURATION_MS;
  const direction = seed < 0.5 ? -1 : 1;
  const overshoot = SPIN_OVERSHOOT_DEG * Math.abs(seed - 0.5) * 2;
  // 前半 70% で 360°+勢い まで回り、残り 30% で勢いぶんを戻して 360° ちょうどで止まる。
  // 最後に 360° → 0° へ mod で畳むので、見た目は連続のまま角度は元に戻る。
  const CLIMB = 0.7;
  let angle: number;
  if (progress < CLIMB) {
    angle = easeInOutCubic(progress / CLIMB) * (360 + overshoot);
  } else {
    const settle = easeInOutCubic((progress - CLIMB) / (1 - CLIMB));
    angle = 360 + overshoot - settle * overshoot;
  }
  return direction * angle;
}

/**
 * 「1ターンにつき1回」のクールダウン。
 * 送ったターン番号を覚えておき、同じターンならもう送れない。
 */
export interface SabotageCooldown {
  lastSentTurnNo: number | null;
}

export const INITIAL_COOLDOWN: SabotageCooldown = { lastSentTurnNo: null };

export function canSendSabotage(cooldown: SabotageCooldown, turnNo: number): boolean {
  return cooldown.lastSentTurnNo !== turnNo;
}

export function markSabotageSent(turnNo: number): SabotageCooldown {
  return { lastSentTurnNo: turnNo };
}
