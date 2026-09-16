// MediaPipe の手のランドマーク検出を、盤面から使いやすい形に包んだもの。担当: ようた（見た目）
//
// カメラ映像から人差し指の先を拾い、画面の座標に直して配る。
// 親指と人差し指をつまむと「決定」とみなす。
//
// React には 2 つの入口を出す。
//   - 状態（読み込み中／動作中／失敗）は useSyncExternalStore 用の subscribe/getSnapshot
//   - 指の位置は毎フレーム変わるので React の state には載せず、subscribeFrame で直接配る
// そうしないと 30〜60fps で再レンダリングが走り、3D タワーが重くなる。
//
// モデルと wasm は CDN から取る。リポジトリに置くと 10MB 近く増えるうえ、
// 一度入れた大きいファイルは履歴から消えない（#43 で通った話と同じ）。

import type { HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * wasm の配布元。import している npm パッケージと同じ版に合わせること
 * （ずれると「wasm と JS の版が違う」で初期化に失敗する）。
 */
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** カメラ映像のうち実際に使う範囲。端まで指を伸ばさなくても画面の端に届くようにする */
const ACTIVE_MARGIN = 0.16;
/** 手ぶれを均す割合。1 に近いほど追従が速く、その分ぶれる */
const SMOOTHING = 0.35;
/**
 * 手の大きさに対する指先の距離が、これを下回ったら「つまんだ」。
 * 一度つまんだあとは PINCH_RELEASE_RATIO を上回るまで離したと見なさない。
 *
 * 入口と出口を分けているのは、しきい値ちょうどで指が震えると
 * つまむ／離すが高速で入れ替わり、ためが何度も振り出しに戻るため。
 */
const PINCH_RATIO = 0.42;
const PINCH_RELEASE_RATIO = 0.58;
/** つまみっぱなしで決定になるまでの時間 */
export const PINCH_HOLD_MS = 700;
/**
 * つまみが外れて見えても、この時間までは「取りこぼし」と見なしてためを保つ。
 *
 * 検出は毎フレーム確実に当たるわけではない。0.7 秒 = 30fps で 21 フレームを
 * 全部成功させる必要があると、1 フレームの取りこぼしでも全部やり直しになる。
 */
const PINCH_RELEASE_GRACE_MS = 220;

/** MediaPipe のランドマーク番号（21点のうち使うぶんだけ） */
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;
/** 手のひらの縦（手首→中指の付け根）は、横（人差し指→小指の付け根）の約 1.25 倍 */
const PALM_ASPECT = 1.25;

export type HandTrackerStatus = "idle" | "loading" | "running" | "error";

export interface HandTrackerSnapshot {
  status: HandTrackerStatus;
  /** 失敗したときに画面に出す文言（日本語） */
  message: string | null;
}

export interface HandFrame {
  /** 手が映っているか。false のときは座標を使わない */
  visible: boolean;
  /** 人差し指の先。ビューポート左上からの px */
  x: number;
  y: number;
  /** 親指と人差し指をつまんでいるか */
  pinching: boolean;
  /** つまみ続けている割合（0〜1）。1 になったら決定 */
  holdProgress: number;
}

const IDLE_SNAPSHOT: HandTrackerSnapshot = { status: "idle", message: null };
const SERVER_SNAPSHOT: HandTrackerSnapshot = IDLE_SNAPSHOT;

/**
 * useSyncExternalStore は毎回同じ参照を返さないと無限ループになるので、
 * 中身が変わったときだけ差し替える。
 */
let snapshot: HandTrackerSnapshot = IDLE_SNAPSHOT;
const statusListeners = new Set<() => void>();
const frameListeners = new Set<(frame: HandFrame) => void>();

let landmarker: HandLandmarker | null = null;
let stream: MediaStream | null = null;
let videoEl: HTMLVideoElement | null = null;
let rafId: number | null = null;
let lastVideoTime = -1;
/** 平滑化後の指先。px ではなく 0〜1 で持つ（画面サイズが変わっても破綻しない） */
let smoothed: { x: number; y: number } | null = null;
/** つまみ始めた時刻。離したら null に戻す */
let pinchStartedAt: number | null = null;
/** つまみが外れて見えはじめた時刻。猶予のうちに戻ってくれば、ためは消さない */
let pinchReleasedAt: number | null = null;
/** 直前のフレームでつまんでいたか。入口と出口のしきい値を切り替えるのに使う */
let wasPinching = false;
/**
 * 一度確定したつまみ。指を離すまで次を数えない。
 * これが無いと、つまんだまま別の行へ流れたときに 0.7 秒ごとに選び直してしまう。
 */
let pinchConsumed = false;
/**
 * start の世代。初回は読み込みに10秒ほどかかるので、その間に止められる
 * （＝盤面が結果画面に切り替わる）ことが普通に起きる。await のたびにこれを
 * 見て、古い呼び出しなら掴んだカメラを手放して抜ける。
 */
let generation = 0;

function setSnapshot(status: HandTrackerStatus, message: string | null = null) {
  if (snapshot.status === status && snapshot.message === message) {
    return;
  }
  snapshot = { status, message };
  for (const listener of statusListeners) {
    listener();
  }
}

export function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getStatusSnapshot(): HandTrackerSnapshot {
  return snapshot;
}

/** サーバー側では常に idle。カメラは当然動かない */
export function getServerStatusSnapshot(): HandTrackerSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeFrame(listener: (frame: HandFrame) => void): () => void {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
}

/** カメラと WebAssembly が使える環境か。iOS の Safari でも http だと false になる */
export function isHandTrackingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia !== undefined
  );
}

/**
 * カメラを開いて検出を始める。
 * 呼び出し側は video 要素を渡す（映像を出すかどうかは呼び出し側の自由）。
 */
export async function startHandTracking(video: HTMLVideoElement): Promise<void> {
  if (snapshot.status === "loading" || snapshot.status === "running") {
    return;
  }
  if (!isHandTrackingSupported()) {
    setSnapshot("error", "この端末ではカメラを使った操作に対応していません。");
    return;
  }

  const myGeneration = ++generation;
  /** この呼び出しがまだ有効か。止められていたら false */
  const isStale = () => myGeneration !== generation;

  setSnapshot("loading");

  try {
    // 重い（数 MB）ので、使うと言われてから初めて読み込む
    const { FilesetResolver, HandLandmarker: HandLandmarkerClass } = await import(
      "@mediapipe/tasks-vision"
    );

    if (isStale()) {
      return;
    }

    if (!landmarker) {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      landmarker = await HandLandmarkerClass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        // 2 人で覗き込むゲームなので、いちばん確からしい 1 本だけ追う
        numHands: 1,
      });
    }

    if (isStale()) {
      return;
    }

    const opened = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    // ここに来るまでに止められていたら、掴んだカメラは自分で閉じる。
    // 手放し忘れると、止めるボタンが消えたあとも録画ランプが点いたままになる。
    if (isStale()) {
      for (const track of opened.getTracks()) {
        track.stop();
      }
      return;
    }

    stream = opened;
    videoEl = video;
    video.srcObject = stream;
    await video.play();

    lastVideoTime = -1;
    smoothed = null;
    resetPinch();
    setSnapshot("running");
    rafId = requestAnimationFrame(tick);
  } catch (error) {
    if (isStale()) {
      return;
    }
    stopHandTracking();
    setSnapshot("error", describeError(error));
  }
}

export function stopHandTracking(): void {
  // 走っている start があれば、そちらに「もう要らない」と伝える
  generation += 1;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl = null;
  }
  smoothed = null;
  resetPinch();
  emit({ visible: false, x: 0, y: 0, pinching: false, holdProgress: 0 });
  // landmarker は作り直しが重いので残す（次に開くときが速い）
  //
  // エラー表示もここで消す。モジュールに状態が残ると、カメラを拒否したあと
  // 別のルームを開いたときに、何も押していないのに前回の文言が出る。
  setSnapshot("idle");
}

function tick() {
  rafId = requestAnimationFrame(tick);

  const video = videoEl;
  if (!landmarker || !video || video.readyState < 2) {
    return;
  }
  // 同じコマを二度解析しない（MediaPipe は同じ時刻を渡すと例外を投げる）
  if (video.currentTime === lastVideoTime) {
    return;
  }
  lastVideoTime = video.currentTime;

  const result = landmarker.detectForVideo(video, performance.now());
  const hand = result.landmarks?.[0];

  if (!hand) {
    smoothed = null;
    // 1 フレーム見失っただけでためを捨てない。猶予の判断は advancePinch に任せる
    // （手を止めていても、検出は時々すべる）
    const holdProgress = advancePinch(false, performance.now());
    emit({ visible: false, x: 0, y: 0, pinching: false, holdProgress });
    return;
  }

  const target = toScreenRatio(hand[INDEX_TIP]);
  smoothed = smoothed
    ? {
        x: smoothed.x + (target.x - smoothed.x) * SMOOTHING,
        y: smoothed.y + (target.y - smoothed.y) * SMOOTHING,
      }
    : target;

  const pinching = isPinching(hand);
  const holdProgress = advancePinch(pinching, performance.now());

  emit({
    visible: true,
    x: smoothed.x * window.innerWidth,
    y: smoothed.y * window.innerHeight,
    pinching,
    holdProgress,
  });
}

/**
 * つまみ続けている割合を1フレーム進める。0〜1 を返し、1 で確定。
 *
 * 一度確定したら、指を離すまで 0 のまま。つまんだまま別の行へ流れても
 * 0.7 秒ごとに選び直さないための決まりごと（#49 のレビュー）。
 *
 * カメラを繋がないと確かめられない部分なので、ここだけ切り出して export している。
 */
export function advancePinch(pinching: boolean, now: number): number {
  if (pinching) {
    pinchReleasedAt = null;
    if (pinchConsumed) {
      return 0;
    }
    pinchStartedAt ??= now;
    return Math.min(1, (now - pinchStartedAt) / PINCH_HOLD_MS);
  }

  // ここから「つまんでいないように見える」
  pinchReleasedAt ??= now;

  if (now - pinchReleasedAt < PINCH_RELEASE_GRACE_MS) {
    // 取りこぼしかもしれないので、状態は消さずに止めておく。
    // 確定済み（consumePinch 後）も同じで、1 フレームの取りこぼしを
    // 「離した」と受け取って二度目を許してしまわないようにする。
    if (pinchConsumed || pinchStartedAt === null) {
      return 0;
    }
    // 進めもしないので、猶予だけで確定することはない
    return Math.min(1, (pinchReleasedAt - pinchStartedAt) / PINCH_HOLD_MS);
  }

  // 猶予を過ぎた。本当に離したと見なす。ここで初めて次のつまみを数えられる
  resetPinch();
  return 0;
}

/**
 * 決定が通ったら呼ぶ。つまんだまま別の行へ流れても、指を離すまでは
 * 二度目が走らない。
 */
export function consumePinch(): void {
  pinchStartedAt = null;
  pinchReleasedAt = null;
  pinchConsumed = true;
}

/**
 * つまみの計測をやり直す。相手の手番など、ねらわせない間に呼んでおく。
 * 溜めたままにすると、自分の手番に戻った最初のフレームで猶予なしに確定してしまう。
 */
export function resetPinch(): void {
  pinchStartedAt = null;
  pinchReleasedAt = null;
  pinchConsumed = false;
  wasPinching = false;
}

/**
 * カメラの座標（0〜1）を画面の座標（0〜1）に直す。
 * 左右は鏡写しにする。自分の右手を上げたら画面の右が光ってほしいため。
 * 端まで手を伸ばさなくても済むよう、真ん中の範囲を画面いっぱいに引き伸ばす。
 *
 * カメラを繋がないと確かめられない部分なので、この計算だけ切り出して export している。
 */
export function toScreenRatio(point: NormalizedLandmark): { x: number; y: number } {
  const span = 1 - ACTIVE_MARGIN * 2;
  return {
    x: clamp01((1 - point.x - ACTIVE_MARGIN) / span),
    y: clamp01((point.y - ACTIVE_MARGIN) / span),
  };
}

/**
 * 手の大きさの見積もり。カメラからの距離が変わっても同じ判定になるよう、
 * つまみ具合をこれで割る。
 *
 * 手首→中指の付け根だけで測ると、画面を指すために手のひらをカメラへ向けた
 * とたんに、その軸が奥へ倒れて短く写る（見込み）。割る数が小さくなるので
 * 比が跳ね上がり、ちゃんとつまんでいるのに判定されなくなる。
 *
 * 付け根どうしの幅（人差し指→小指）は、手のひらを向けても横を向いたままで
 * 縮まない。2つのうち長いほうを採る（投影は縮める方向にしか働かないので、
 * 長いほうが本来の大きさに近い）。
 */
export function estimateHandSize(hand: NormalizedLandmark[]): number {
  const palmLength = distance(hand[WRIST], hand[MIDDLE_MCP]);
  const knuckleSpan = distance(hand[INDEX_MCP], hand[PINKY_MCP]) * PALM_ASPECT;
  return Math.max(palmLength, knuckleSpan);
}

/**
 * つまんでいるかどうか。指先どうしの距離を手の大きさで割って測るので、
 * カメラに近づいても遠ざかっても同じ判定になる。
 *
 * 一度つまんだら、はっきり離すまでは「つまんでいる」ままにする（ヒステリシス）。
 *
 * toScreenRatio と同じく、テストから直接確かめられるように export している。
 */
export function isPinching(hand: NormalizedLandmark[]): boolean {
  const handSize = estimateHandSize(hand);
  if (handSize === 0) {
    return false;
  }
  const ratio = distance(hand[THUMB_TIP], hand[INDEX_TIP]) / handSize;
  const threshold = wasPinching ? PINCH_RELEASE_RATIO : PINCH_RATIO;
  wasPinching = ratio < threshold;
  return wasPinching;
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function emit(frame: HandFrame) {
  for (const listener of frameListeners) {
    listener(frame);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "カメラの使用が許可されませんでした。ブラウザの設定から許可してください。";
    }
    if (error.name === "NotFoundError") {
      return "カメラが見つかりませんでした。";
    }
  }
  return "カメラの準備に失敗しました。もう一度試してください。";
}
