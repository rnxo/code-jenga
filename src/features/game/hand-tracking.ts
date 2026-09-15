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
/** 手の大きさに対する指先の距離がこれを下回ったら「つまんだ」とみなす */
const PINCH_RATIO = 0.42;
/** つまみっぱなしで決定になるまでの時間 */
export const PINCH_HOLD_MS = 700;

/** MediaPipe のランドマーク番号（21点のうち使うぶんだけ） */
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

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

  setSnapshot("loading");

  try {
    // 重い（数 MB）ので、使うと言われてから初めて読み込む
    const { FilesetResolver, HandLandmarker: HandLandmarkerClass } = await import(
      "@mediapipe/tasks-vision"
    );

    if (!landmarker) {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      landmarker = await HandLandmarkerClass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        // 2 人で覗き込むゲームなので、いちばん確からしい 1 本だけ追う
        numHands: 1,
      });
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });

    videoEl = video;
    video.srcObject = stream;
    await video.play();

    lastVideoTime = -1;
    smoothed = null;
    pinchStartedAt = null;
    setSnapshot("running");
    rafId = requestAnimationFrame(tick);
  } catch (error) {
    stopHandTracking();
    setSnapshot("error", describeError(error));
  }
}

export function stopHandTracking(): void {
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
  pinchStartedAt = null;
  emit({ visible: false, x: 0, y: 0, pinching: false, holdProgress: 0 });
  // landmarker は作り直しが重いので残す（次に開くときが速い）
  if (snapshot.status !== "error") {
    setSnapshot("idle");
  }
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
    pinchStartedAt = null;
    emit({ visible: false, x: 0, y: 0, pinching: false, holdProgress: 0 });
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
  const now = performance.now();
  if (pinching) {
    pinchStartedAt ??= now;
  } else {
    pinchStartedAt = null;
  }
  const holdProgress =
    pinchStartedAt === null ? 0 : Math.min(1, (now - pinchStartedAt) / PINCH_HOLD_MS);

  emit({
    visible: true,
    x: smoothed.x * window.innerWidth,
    y: smoothed.y * window.innerHeight,
    pinching,
    holdProgress,
  });
}

/** 決定が通ったら呼ぶ。つまんだままでも二度目が走らないようにする */
export function consumePinch(): void {
  pinchStartedAt = null;
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
 * つまんでいるかどうか。指先どうしの距離を手の大きさで割って測るので、
 * カメラに近づいても遠ざかっても同じ判定になる。
 *
 * toScreenRatio と同じく、テストから直接確かめられるように export している。
 */
export function isPinching(hand: NormalizedLandmark[]): boolean {
  const pinchDistance = distance(hand[THUMB_TIP], hand[INDEX_TIP]);
  const handSize = distance(hand[WRIST], hand[MIDDLE_MCP]);
  if (handSize === 0) {
    return false;
  }
  return pinchDistance / handSize < PINCH_RATIO;
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
