// マスコットに日本語を読み上げさせる。担当: ようた（見た目）
//
// これまでは mascot-voice.ts が1文字ずつ短い音を鳴らしていた（どうぶつの森ふう）。
// 「言葉を喋らせたい」という要望を受けて、ブラウザの音声合成に載せ替える。
//
// ただし音声合成は端末まかせで、日本語の声が1つも入っていない環境もある。
// その場合は今までの合成音に落ちる（Mascot 側で分岐する）。
//
// 音源ファイルは持たない方針は変わらない。

import { isSoundMuted, subscribeSoundMuted } from "./sound-settings";
import type { MascotMood } from "./mascot-lines";

/**
 * 使いたい声の順番。
 *
 * おせっかいくんは生意気な子どもなので、読み上げソフトらしい声より
 * 抑揚のある声のほうが合う。入っていなければ順に次を試し、
 * 最後は「日本語ならなんでも」で拾う。
 */
const PREFERRED_VOICES = ["Rocko", "Eddy", "Flo", "Sandy", "Reed", "Shelley", "Kyoko", "Otoya", "Haruka", "Ayumi"];

interface SpeechTone {
  /** 速さ。1 がふつう */
  rate: number;
  /** 高さ。1 がふつう */
  pitch: number;
}

const TONE: Record<MascotMood, SpeechTone> = {
  // ふだん。少しだけ高く、軽い
  idle: { rate: 1.05, pitch: 1.15 },
  // ニヤリ。ゆっくり低く、煽るように
  smug: { rate: 0.9, pitch: 0.95 },
  // 焦り。早口で高く
  panic: { rate: 1.5, pitch: 1.5 },
};

/** 選んだ声。毎回探し直すと重いので覚えておく */
let voice: SpeechVoice | null = null;
type SpeechVoice = SpeechSynthesisVoice;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

/**
 * 日本語の声を1つ選ぶ。
 * getVoices() は最初の呼び出しで空のことがあるので、その場合は null を返し、
 * 次に呼ばれたときに選び直す（voiceschanged を待つより素直）。
 */
function pickVoice(): SpeechVoice | null {
  if (voice) {
    return voice;
  }
  const speech = synth();
  if (!speech) {
    return null;
  }
  const japanese = speech.getVoices().filter((candidate) => /^ja/i.test(candidate.lang));
  if (japanese.length === 0) {
    return null;
  }
  voice =
    PREFERRED_VOICES.map((name) =>
      japanese.find((candidate) => candidate.name.startsWith(name)),
    ).find((found): found is SpeechVoice => found !== undefined) ?? japanese[0];
  return voice;
}

/** 読み上げが使えるか。日本語の声が1つも無ければ使えない扱いにする */
export function isSpeechAvailable(): boolean {
  return pickVoice() !== null;
}

/** 声の一覧が後から届くことがあるので、届いたら知らせる */
export function subscribeVoices(listener: () => void): () => void {
  const speech = synth();
  if (!speech) {
    return () => {};
  }
  const handle = () => {
    // 声が入れ替わることもあるので選び直す
    voice = null;
    listener();
  };
  speech.addEventListener("voiceschanged", handle);
  return () => speech.removeEventListener("voiceschanged", handle);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

/**
 * 消音されたら、言いかけも止める。
 *
 * 部品側の再描画を待つと、押してから止まるまでに間が空く（実測で
 * 0.5 秒たっても喋り続けていた）。スイッチそのものを見て、その場で切る。
 */
let watchingMute = false;
function watchMute(): void {
  if (watchingMute) {
    return;
  }
  watchingMute = true;
  subscribeSoundMuted(() => {
    if (isSoundMuted()) {
      stopSpeaking();
    }
  });
}

/**
 * セリフを読み上げる。すでに喋っていれば、そちらは止めて言い直す
 * （吹き出しが切り替わったのに前のセリフが続くと気持ち悪いため）。
 */
export function speak(message: string, mood: MascotMood): boolean {
  const speech = synth();
  const chosen = pickVoice();
  if (!speech || !chosen || isSoundMuted() || message.length === 0) {
    return false;
  }

  watchMute();

  speech.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.voice = chosen;
  utterance.lang = chosen.lang;
  const tone = TONE[mood];
  utterance.rate = tone.rate;
  utterance.pitch = tone.pitch;
  // 効果音より前に出すぎないよう、少しだけ控える
  utterance.volume = 0.9;
  speech.speak(utterance);
  return true;
}
