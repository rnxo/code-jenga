// MediaPipe の手のランドマーク検出を、盤面から使いやすい形に包んだもの。担当: ようた（見た目）
//
// カメラ映像から人差し指の先を拾い、画面の座標に直して配る。
// 同じところに指を止め続けると「決定」とみなす（つまみ動作は使わない）。
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
/** 同じところに指を止め続けて、決定になるまでの時間 */
export const DWELL_MS = 1200;
/**
 * 「止まっている」と見なす揺れの幅（px）。
 *
 * 手は必ず震えるので 0 にはできない。広げすぎると、隣の木片へ移ったのに
 * 数え続けてしまう。木片の高さ（詰めたときで 23px 前後）より少し小さい値にし、
 * 行が変わったかどうかは座標ではなく「どの木片の上か」で見る。
 */
const DWELL_RADIUS_PX = 18;
/**
 * 指を見失っても、この時間までは「取りこぼし」と見なして数えたぶんを保つ。
 *
 * 検出は毎フレーム確実に当たるわけではない。1.2 秒 = 30fps で 36 フレームを
 * 全部成功させる必要があると、1 フレームの取りこぼしでも全部やり直しになる。
 */
const DWELL_LOST_GRACE_MS = 220;

/** MediaPipe のランドマーク番号（21点のうち使うぶんだけ） */
const INDEX_TIP = 8;

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
/** いま数えている対象（行番号など）。変わったら数え直す */
let dwellKey: string | null = null;
/** 数え始めた場所。ここから DWELL_RADIUS_PX 以上動いたら数え直す */
let dwellAnchor: { x: number; y: number } | null = null;
/** 数え始めた時刻 */
let dwellStartedAt: number | null = null;
/** 対象を見失った時刻。猶予のうちに戻ってくれば、数えたぶんは消さない */
let dwellLostAt: number | null = null;
/**
 * 一度確定した滞在。その場から離れるまで次を数えない。
 * これが無いと、指を置いたままだと 1.2 秒ごとに何度も削除してしまう。
 */
let dwellConsumed = false;
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
    resetDwell();
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
  resetDwell();
  emit({ visible: false, x: 0, y: 0 });
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
    // ここでは数えたぶんを捨てない。1 フレーム見失っただけかもしれないので、
    // 猶予の判断は advanceDwell に任せる（対象なしとして呼ばれる）
    emit({ visible: false, x: 0, y: 0 });
    return;
  }

  const target = toScreenRatio(hand[INDEX_TIP]);
  smoothed = smoothed
    ? {
        x: smoothed.x + (target.x - smoothed.x) * SMOOTHING,
        y: smoothed.y + (target.y - smoothed.y) * SMOOTHING,
      }
    : target;

  emit({
    visible: true,
    x: smoothed.x * window.innerWidth,
    y: smoothed.y * window.innerHeight,
  });
}

/**
 * 同じところに指が止まっている時間を1フレーム進める。0〜1 を返し、1 で決定。
 *
 * key は「いま指している対象」。行番号でも、ボタンの名前でもよい。
 * これが変われば数え直す。座標だけで見ると、木片をまたいでも数え続けてしまう。
 *
 * 対象から外れた（key が null）ときは、すぐには捨てずに猶予を置く。
 * 検出は毎フレーム当たるわけではないので、1 フレームの取りこぼしで
 * 振り出しに戻ると、いつまでも決定できない。
 *
 * カメラを繋がないと確かめられない部分なので、ここだけ切り出して export している。
 */
export function advanceDwell(
  key: string | null,
  x: number,
  y: number,
  now: number,
): number {
  if (key === null) {
    if (dwellKey === null) {
      resetDwell();
      return 0;
    }
    dwellLostAt ??= now;
    if (now - dwellLostAt < DWELL_LOST_GRACE_MS) {
      // 取りこぼしかもしれないので、数えたぶんは残す。
      // 進めはしないので、猶予だけで決定することはない
      return dwellConsumed || dwellStartedAt === null
        ? 0
        : Math.min(1, (dwellLostAt - dwellStartedAt) / DWELL_MS);
    }
    resetDwell();
    return 0;
  }

  dwellLostAt = null;

  const moved =
    dwellAnchor === null || Math.hypot(x - dwellAnchor.x, y - dwellAnchor.y) > DWELL_RADIUS_PX;

  if (key !== dwellKey || moved) {
    // 別のものを指した、または指が動いた。ここから数え直す
    dwellKey = key;
    dwellAnchor = { x, y };
    dwellStartedAt = now;
    dwellConsumed = false;
    return 0;
  }

  if (dwellConsumed) {
    return 0;
  }
  return Math.min(1, (now - (dwellStartedAt ?? now)) / DWELL_MS);
}

/**
 * 決定が通ったら呼ぶ。指を置いたままでも、その場から離れるまで二度目は走らない。
 */
export function consumeDwell(): void {
  dwellConsumed = true;
}

/** 数え直す。ねらわせない間（相手の手番など）に呼んでおく */
export function resetDwell(): void {
  dwellKey = null;
  dwellAnchor = null;
  dwellStartedAt = null;
  dwellLostAt = null;
  dwellConsumed = false;
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
