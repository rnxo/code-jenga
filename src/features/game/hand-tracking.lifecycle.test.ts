import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 読み込みの途中で止められたときに、カメラを掴んだままにしないことを確かめる（#49 レビュー 1）。
// 実物の MediaPipe は 18MB 取りに行くので、ここでは差し替える。

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  HandLandmarker: {
    createFromOptions: async () => ({
      detectForVideo: () => ({ landmarks: [] }),
      close: () => {},
    }),
  },
}));

import { getStatusSnapshot, startHandTracking, stopHandTracking } from "./hand-tracking";

/** getUserMedia の解決を外から操る。読み込み中の一瞬を作るために使う */
function deferredCamera() {
  const stopped: string[] = [];
  const track = {
    kind: "video",
    readyState: "live",
    stop() {
      this.readyState = "ended";
      stopped.push("video");
    },
  };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const getUserMedia = vi.fn(async () => {
    await gate;
    return stream;
  });

  return { getUserMedia, release, track, stopped };
}

function fakeVideo() {
  return {
    srcObject: null as MediaStream | null,
    readyState: 0,
    currentTime: 0,
    play: async () => {},
  } as unknown as HTMLVideoElement;
}

describe("startHandTracking を読み込み中に止めたとき", () => {
  let camera: ReturnType<typeof deferredCamera>;

  beforeEach(() => {
    camera = deferredCamera();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: camera.getUserMedia },
    });
    vi.stubGlobal("WebAssembly", {});
  });

  afterEach(() => {
    stopHandTracking();
    vi.unstubAllGlobals();
  });

  it("あとから開いたカメラを掴んだままにしない", async () => {
    const video = fakeVideo();
    const starting = startHandTracking(video);

    // カメラの取得待ちに入るまで進める
    await vi.waitFor(() => expect(camera.getUserMedia).toHaveBeenCalled());

    // ここで盤面が結果画面に切り替わる（HandPointer の cleanup が走る）
    stopHandTracking();

    // 止めたあとに getUserMedia が解決する
    camera.release();
    await starting;

    expect(camera.track.readyState).toBe("ended");
    expect(video.srcObject).toBeNull();
    expect(getStatusSnapshot().status).toBe("idle");
  });

  it("モデルの読み込み中に止めれば、カメラは開かない", async () => {
    const video = fakeVideo();
    const starting = startHandTracking(video);
    stopHandTracking();
    camera.release();
    await starting;

    expect(video.srcObject).toBeNull();
    expect(getStatusSnapshot().status).toBe("idle");
  });

  it("止めずに待てば、ふつうに動き出す", async () => {
    const video = fakeVideo();
    const starting = startHandTracking(video);
    camera.release();
    await starting;

    expect(camera.track.readyState).toBe("live");
    expect(video.srcObject).not.toBeNull();
    expect(getStatusSnapshot().status).toBe("running");
  });

  it("止めるとエラー表示も消える（次に開いた盤面に持ち越さない）", async () => {
    const video = fakeVideo();
    const starting = startHandTracking(video);
    camera.release();
    await starting;

    stopHandTracking();
    expect(getStatusSnapshot()).toEqual({ status: "idle", message: null });
  });
});
