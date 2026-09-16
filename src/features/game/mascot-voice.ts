// マスコットの声。担当: ようた（見た目）
//
// セリフを1文字ずつ短い音にして並べる（どうぶつの森のような喋り方）。
// collapse-sound.ts / silly-sounds.ts と同じで音源ファイルは持たないので、
// 声優の手配もライセンスも要らず、リポジトリも太らない。
//
// 音の高さは文字コードから決めるので、同じセリフはいつ聞いても同じ節回しになる。
// 表情（mood）で声色と速さを変えるため、焦っているときは早口で高くなる。
//
// 実際の言葉として聞き取れる必要はない。吹き出しの文字は目で読めるので、
// 声の役割は「誰が喋っているか」と「どんな気分か」を伝えることに絞る。

import { isSoundMuted } from "./sound-settings";
import type { MascotMood } from "./mascot-lines";

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

interface VoiceProfile {
  /** 声の高さの基準 */
  baseHz: number;
  /** 1文字進むのにかける時間 */
  stepSeconds: number;
  /** 1文字ぶんの音の長さ */
  blipSeconds: number;
  wave: OscillatorType;
  /** 角を丸める。square のままだと耳に刺さる */
  cutoffHz: number;
  gain: number;
}

const VOICE: Record<MascotMood, VoiceProfile> = {
  // ふだん。落ち着いた中くらいの声
  idle: { baseHz: 420, stepSeconds: 0.052, blipSeconds: 0.075, wave: "triangle", cutoffHz: 2600, gain: 0.1 },
  // ニヤリ。低めで、ゆっくり煽る
  smug: { baseHz: 340, stepSeconds: 0.064, blipSeconds: 0.092, wave: "sine", cutoffHz: 2200, gain: 0.11 },
  // 焦り。高くて早口
  panic: { baseHz: 560, stepSeconds: 0.036, blipSeconds: 0.052, wave: "square", cutoffHz: 1800, gain: 0.075 },
};

/** 声にせず「間」にする文字。句読点はためて喋るように聞こえる */
const PAUSE_LONG = "。．！？!?…‥";
const PAUSE_SHORT = "、，,・「」『』（）()　 \n";

/** 1つのセリフで鳴らす音の上限。長文で延々と喋り続けないための頭打ち */
const MAX_BLIPS = 36;

/** 鳴らしている最中の音。次のセリフが来たら止める */
let speaking: OscillatorNode[] = [];

export function stopMascotVoice(): void {
  for (const osc of speaking) {
    try {
      osc.stop();
    } catch {
      // すでに止まっているものは無視してよい
    }
  }
  speaking = [];
}

/**
 * セリフを喋る。すでに喋っていれば、そちらは止めて言い直す
 * （吹き出しが切り替わったのに前のセリフが続くと気持ち悪いため）。
 */
export function speakMascotLine(message: string, mood: MascotMood): void {
  stopMascotVoice();

  if (isSoundMuted() || message.length === 0) {
    return;
  }
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  // タブが一度も操作されていないと suspended のまま。戻せなければ黙って諦める
  void ctx.resume().catch(() => {});

  const voice = VOICE[mood];
  let at = ctx.currentTime + 0.02;
  let spoken = 0;

  for (const char of message) {
    if (spoken >= MAX_BLIPS) {
      break;
    }
    if (PAUSE_LONG.includes(char)) {
      at += voice.stepSeconds * 3.2;
      continue;
    }
    if (PAUSE_SHORT.includes(char)) {
      at += voice.stepSeconds * 1.6;
      continue;
    }

    speaking.push(blip(ctx, voice, at, char));
    at += voice.stepSeconds;
    spoken += 1;
  }
}

/**
 * 1文字ぶんの音。高さは文字コードから決める（同じセリフなら毎回同じ節になる）。
 * 音程を少しだけ動かすと、平坦なピッという音ではなく喋っているように聞こえる。
 */
function blip(ctx: AudioContext, voice: VoiceProfile, at: number, char: string): OscillatorNode {
  // 半音7つぶんの中で散らす。広げすぎると歌になってしまう
  const semitone = (char.codePointAt(0) ?? 0) % 8;
  const startHz = voice.baseHz * Math.pow(2, semitone / 12);

  const osc = ctx.createOscillator();
  osc.type = voice.wave;
  osc.frequency.setValueAtTime(startHz, at);
  osc.frequency.exponentialRampToValueAtTime(startHz * 0.88, at + voice.blipSeconds);

  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(voice.cutoffHz, at);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(voice.gain, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + voice.blipSeconds);

  osc.connect(low).connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + voice.blipSeconds + 0.01);
  osc.onended = () => {
    speaking = speaking.filter((node) => node !== osc);
  };
  return osc;
}
