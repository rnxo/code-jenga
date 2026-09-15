// セクションを叩いたときに鳴る、突拍子のない音。担当: ようた（見た目）
//
// collapse-sound.ts と同じで Web Audio で合成する。音源ファイルを持たないので
// 素材のライセンスを気にせずに済み、リポジトリも太らない。
//
// 音はセクションごとに固定にしてある。叩くたびに総入れ替えだと「何が起きたのか」
// が分からないが、場所と音が結びついていると、触っているうちに気づいて楽しい。
// 同じ音でも鳴るたびに少しだけ音程をずらすので、連打しても機械的にならない。

import { isSoundMuted } from "./sound-settings";

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (context === null) {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    context = new Ctor();
  }
  return context;
}

export const SILLY_SOUNDS = [
  "boing",
  "slideUp",
  "slideDown",
  "quack",
  "scratch",
  "pop",
  "womp",
  "cuckoo",
  "horn",
  "raspberry",
  "theremin",
] as const;

export type SillySound = (typeof SILLY_SOUNDS)[number];

/** 同時に鳴らしすぎて割れないよう、全体の音量はここで抑える */
const MASTER_GAIN = 0.22;
/** 連打したときに音が完全に同じにならないための、音程のばらつき（半音の何分の一か） */
const PITCH_JITTER = 0.06;

/** 名前から鳴らす。名前が分からなければ何も鳴らさない */
export function playSillySound(sound: SillySound): void {
  if (isSoundMuted()) {
    return;
  }
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  // タブが操作されるまで AudioContext は suspended のまま。再開できなければ黙って諦める
  void ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  // 鳴るたびに少しだけ上下させる（1.0 を中心に ±6%）
  const bend = 1 + (Math.random() * 2 - 1) * PITCH_JITTER;

  switch (sound) {
    case "boing":
      playBoing(ctx, now, bend);
      return;
    case "slideUp":
      playSlide(ctx, now, bend, "up");
      return;
    case "slideDown":
      playSlide(ctx, now, bend, "down");
      return;
    case "quack":
      playQuack(ctx, now, bend);
      return;
    case "scratch":
      playScratch(ctx, now);
      return;
    case "pop":
      playPop(ctx, now, bend);
      return;
    case "womp":
      playWomp(ctx, now, bend);
      return;
    case "cuckoo":
      playCuckoo(ctx, now, bend);
      return;
    case "horn":
      playHorn(ctx, now, bend);
      return;
    case "raspberry":
      playRaspberry(ctx, now, bend);
      return;
    case "theremin":
      playTheremin(ctx, now, bend);
      return;
  }
}

/** 出口。ここを通した音だけが鳴る */
function master(ctx: AudioContext, at: number, peak: number, seconds: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak * MASTER_GAIN, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  gain.connect(ctx.destination);
  return gain;
}

/** ばね。高いところから落ちながら細かく震える */
function playBoing(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.42;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(760 * bend, at);
  osc.frequency.exponentialRampToValueAtTime(110 * bend, at + duration);

  // 震え。これが無いと、ただ下がるだけの音になる
  const wobble = ctx.createOscillator();
  wobble.type = "sine";
  wobble.frequency.setValueAtTime(19, at);
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.setValueAtTime(190, at);
  wobbleDepth.gain.exponentialRampToValueAtTime(8, at + duration);
  wobble.connect(wobbleDepth).connect(osc.frequency);

  osc.connect(master(ctx, at, 1, duration));
  osc.start(at);
  wobble.start(at);
  osc.stop(at + duration);
  wobble.stop(at + duration);
}

/** スライドホイッスル。上がるか下がるか */
function playSlide(ctx: AudioContext, at: number, bend: number, direction: "up" | "down") {
  const duration = 0.5;
  const from = (direction === "up" ? 240 : 1700) * bend;
  const to = (direction === "up" ? 1700 : 240) * bend;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + duration);

  // 息のゆらぎ
  const vibrato = ctx.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.setValueAtTime(7, at);
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.setValueAtTime(22, at);
  vibrato.connect(vibratoDepth).connect(osc.frequency);

  osc.connect(master(ctx, at, 0.85, duration));
  osc.start(at);
  vibrato.start(at);
  osc.stop(at + duration);
  vibrato.stop(at + duration);
}

/** あひる。鋭い倍音を帯域で抜いて、細かく揺らす */
function playQuack(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.24;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(390 * bend, at);
  osc.frequency.exponentialRampToValueAtTime(280 * bend, at + duration);

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(950, at);
  band.Q.setValueAtTime(7, at);

  // 音量を細かく揺らすと「ガーガー」になる
  const tremolo = ctx.createOscillator();
  tremolo.type = "square";
  tremolo.frequency.setValueAtTime(48, at);
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.setValueAtTime(0.35, at);

  const out = master(ctx, at, 0.9, duration);
  tremolo.connect(tremoloDepth).connect(out.gain);
  osc.connect(band).connect(out);

  osc.start(at);
  tremolo.start(at);
  osc.stop(at + duration);
  tremolo.stop(at + duration);
}

/** レコードの引っかき。ノイズの帯域を行ったり来たりさせる */
function playScratch(ctx: AudioContext, at: number) {
  const duration = 0.34;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(1.6, at);
  source.playbackRate.linearRampToValueAtTime(0.5, at + duration);

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.setValueAtTime(4.5, at);
  band.frequency.setValueAtTime(520, at);
  band.frequency.exponentialRampToValueAtTime(3200, at + duration * 0.45);
  band.frequency.exponentialRampToValueAtTime(600, at + duration);

  source.connect(band).connect(master(ctx, at, 1.1, duration));
  source.start(at);
  source.stop(at + duration);
}

/** 栓が抜ける音。短く、いさぎよく */
function playPop(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.1;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1000 * bend, at);
  osc.frequency.exponentialRampToValueAtTime(170 * bend, at + duration);
  osc.connect(master(ctx, at, 1.2, duration));
  osc.start(at);
  osc.stop(at + duration);
}

/** がっかりのトロンボーン。2 音下がる */
function playWomp(ctx: AudioContext, at: number, bend: number) {
  const notes = [210, 165];
  notes.forEach((freq, index) => {
    const start = at + index * 0.17;
    const duration = 0.2;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq * bend, start);
    osc.frequency.exponentialRampToValueAtTime(freq * bend * 0.9, start + duration);

    // 口を閉じていくような「ワゥ」
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(1900, start);
    low.frequency.exponentialRampToValueAtTime(320, start + duration);
    low.Q.setValueAtTime(6, start);

    osc.connect(low).connect(master(ctx, start, 0.8, duration));
    osc.start(start);
    osc.stop(start + duration);
  });
}

/** 鳩時計。短三度で 2 回 */
function playCuckoo(ctx: AudioContext, at: number, bend: number) {
  const notes = [784, 659];
  notes.forEach((freq, index) => {
    const start = at + index * 0.21;
    const duration = 0.19;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * bend, start);

    const tremolo = ctx.createOscillator();
    tremolo.type = "sine";
    tremolo.frequency.setValueAtTime(11, start);
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.setValueAtTime(0.14, start);

    const out = master(ctx, start, 0.75, duration);
    tremolo.connect(tremoloDepth).connect(out.gain);
    osc.connect(out);

    osc.start(start);
    tremolo.start(start);
    osc.stop(start + duration);
    tremolo.stop(start + duration);
  });
}

/** 自転車のラッパ。わざと少しだけ音程をずらした 2 本で濁らせる */
function playHorn(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.3;
  const out = master(ctx, at, 0.55, duration);

  for (const freq of [466, 587]) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq * bend, at);
    osc.detune.setValueAtTime(8, at);

    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(2200, at);

    osc.connect(low).connect(out);
    osc.start(at);
    osc.stop(at + duration);
  }
}

/** 唇を鳴らしたような「ブルルッ」。低い鋸波を細かく刻む */
function playRaspberry(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.32;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95 * bend, at);
  osc.frequency.exponentialRampToValueAtTime(70 * bend, at + duration);

  const chop = ctx.createOscillator();
  chop.type = "square";
  chop.frequency.setValueAtTime(27, at);
  chop.frequency.exponentialRampToValueAtTime(19, at + duration);
  const chopDepth = ctx.createGain();
  chopDepth.gain.setValueAtTime(0.45, at);

  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(430, at);

  const out = master(ctx, at, 1, duration);
  chop.connect(chopDepth).connect(out.gain);
  osc.connect(low).connect(out);

  osc.start(at);
  chop.start(at);
  osc.stop(at + duration);
  chop.stop(at + duration);
}

/** テルミン。大きく揺れながら伸びる、宇宙人みたいな音 */
function playTheremin(ctx: AudioContext, at: number, bend: number) {
  const duration = 0.62;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520 * bend, at);
  osc.frequency.exponentialRampToValueAtTime(880 * bend, at + duration * 0.6);
  osc.frequency.exponentialRampToValueAtTime(400 * bend, at + duration);

  const vibrato = ctx.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.setValueAtTime(6.5, at);
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.setValueAtTime(70, at);
  vibrato.connect(vibratoDepth).connect(osc.frequency);

  osc.connect(master(ctx, at, 0.7, duration));
  osc.start(at);
  vibrato.start(at);
  osc.stop(at + duration);
  vibrato.stop(at + duration);
}
