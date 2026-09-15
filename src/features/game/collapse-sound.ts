// 崩壊の効果音。Web Audio API で合成するので音源ファイルは持たない
// （＝素材のライセンスを気にしなくてよく、リポジトリも太らない）。
//
// 鳴らすのは3層:
//   1. 木片がぶつかる乾いた音（clack）を、落下のばらけ方に合わせて数発
//   2. 崩れる低い唸り（rumble）
//   3. 光の演出に合わせた短い残響（shimmer）
//
// 自動再生の制限により、ユーザー操作を経ていないタブでは AudioContext が
// suspended のままになる。resume() を試し、失敗しても黙って諦める
// （音が出ないだけでゲームは進む）。

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (context === null) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    context = new Ctor();
  }
  return context;
}

/** ホワイトノイズのバッファ。木同士がぶつかる音の立ち上がりと、崩れる唸りに使う。 */
function createNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** 木片が1つぶつかる音。短い胴鳴り＋立ち上がりのノイズ。 */
function playClack(ctx: AudioContext, at: number, frequency: number, gain: number) {
  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(frequency, at);
  // 木は叩いた瞬間だけ高く鳴ってすぐ落ちる
  body.frequency.exponentialRampToValueAtTime(frequency * 0.6, at + 0.09);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0, at);
  bodyGain.gain.linearRampToValueAtTime(gain, at + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);

  body.connect(bodyGain).connect(ctx.destination);
  body.start(at);
  body.stop(at + 0.14);

  const attack = ctx.createBufferSource();
  attack.buffer = createNoise(ctx, 0.05);

  const attackFilter = ctx.createBiquadFilter();
  attackFilter.type = "bandpass";
  attackFilter.frequency.setValueAtTime(frequency * 3.5, at);
  attackFilter.Q.setValueAtTime(1.2, at);

  const attackGain = ctx.createGain();
  attackGain.gain.setValueAtTime(gain * 0.7, at);
  attackGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

  attack.connect(attackFilter).connect(attackGain).connect(ctx.destination);
  attack.start(at);
  attack.stop(at + 0.05);
}

/** 崩れる低い唸り。ローパスを落としながら減衰させる。 */
function playRumble(ctx: AudioContext, at: number) {
  const source = ctx.createBufferSource();
  source.buffer = createNoise(ctx, 1.2);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(420, at);
  filter.frequency.exponentialRampToValueAtTime(90, at + 1.1);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.22, at + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(at);
  source.stop(at + 1.2);
}

/** 奥から差す光に合わせた残響。崩壊の締め。 */
function playShimmer(ctx: AudioContext, at: number) {
  for (const [index, frequency] of [523.25, 784, 1046.5].entries()) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, at);

    const gain = ctx.createGain();
    const start = at + index * 0.05;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.9);
  }
}

/**
 * 崩壊の音を鳴らす。pieceCount は積み木の数で、ぶつかる音の数に反映する。
 * 音が出せない環境（自動再生制限・AudioContext 非対応）では何もしない。
 */
export function playCollapseSound(pieceCount: number) {
  const ctx = getContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      // ユーザー操作を経ていないタブでは鳴らせない。ゲームは止めない
    });
  }

  const now = ctx.currentTime + 0.02;

  playRumble(ctx, now);

  // 落下の staggered delay（上の段ほど遅い）に合わせて、ぶつかる音をばらけさせる
  const hits = Math.min(6, Math.max(3, pieceCount));
  for (let i = 0; i < hits; i += 1) {
    const at = now + 0.04 + i * 0.085 + Math.random() * 0.03;
    // 段ごとに少しずつ違う音程にして、同じ音の連打に聞こえないようにする
    const frequency = 210 + Math.random() * 120 - i * 8;
    const gain = 0.32 - i * 0.02;
    playClack(ctx, at, frequency, Math.max(0.12, gain));
  }

  playShimmer(ctx, now + 0.55);
}
