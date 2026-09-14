
"use client";

import { useEffect, useRef, useState } from "react";
import {
    FilesetResolver,
    HandLandmarker,
    DrawingUtils,
} from "@mediapipe/tasks-vision";

type Gesture =
    | "NONE"
    | "SCISSORS"
    | "GRAB"
    | "WAVE"
    | "CUT"
    | "SLAM";

type Point = {
    x: number;
    y: number;
    time: number;
};

type GestureFrame = {
    gesture: Gesture;
    time: number;
};

/**
 * ============================
 * 設定値
 * ============================
 */

// 約20FPS
const DETECTION_INTERVAL = 50;

// 全ジェスチャー共通
const GESTURE_HISTORY_SIZE = 5;

// 5枚中3枚以上なら多数決成立
const MAJORITY_COUNT = 3;

// モーション計算に使う時間
const MOTION_HISTORY_MS = 500;

// 加速度計算用
const ACCELERATION_HISTORY_SIZE = 4;

// CUT
const CUT_MIN_ACCELERATION = 0.000003;
const CUT_COOLDOWN_MS = 700;

// SLAM
const SLAM_MIN_ACCELERATION = 0.000003;
const SLAM_COOLDOWN_MS = 900;

// WAVE
const WAVE_MIN_ACCELERATION = 0.000002;
const WAVE_COOLDOWN_MS = 700;


/**
 * ============================
 * HandTracker
 * ============================
 */

export default function HandTracker() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef =
        useRef<number | null>(null);

    const lastDetectionTimeRef = useRef(0);

    /**
     * 手の位置履歴
     */
    const motionHistoryRef = useRef<Point[]>([]);

    /**
     * 全ジェスチャーの5フレーム履歴
     */
    const gestureHistoryRef =
        useRef<GestureFrame[]>([]);

    /**
     * 加速度計算用の速度履歴
     */
    const velocityHistoryRef = useRef<
        {
            vx: number;
            vy: number;
            time: number;
        }[]
    >([]);

    /**
     * 各アクションのクールダウン
     */
    const lastCutTimeRef = useRef(0);
    const lastSlamTimeRef = useRef(0);
    const lastWaveTimeRef = useRef(0);

    const [gesture, setGesture] =
        useState<Gesture>("NONE");

    const [status, setStatus] =
        useState("初期化中...");


    /**
     * ============================
     * 指判定
     * ============================
     */

    const isFingerExtended = (
        landmarks: Array<{
            x: number;
            y: number;
        }>,
        tipIndex: number,
        pipIndex: number
    ): boolean => {
        return (
            landmarks[tipIndex].y <
            landmarks[pipIndex].y
        );
    };


    /**
     * ============================
     * ✌️ SCISSORS
     * ============================
     */

    const isScissors = (
        landmarks: Array<{
            x: number;
            y: number;
        }>
    ): boolean => {
        const indexOpen =
            isFingerExtended(
                landmarks,
                8,
                6
            );

        const middleOpen =
            isFingerExtended(
                landmarks,
                12,
                10
            );

        const ringClosed =
            !isFingerExtended(
                landmarks,
                16,
                14
            );

        const pinkyClosed =
            !isFingerExtended(
                landmarks,
                20,
                18
            );

        return (
            indexOpen &&
            middleOpen &&
            ringClosed &&
            pinkyClosed
        );
    };


    /**
     * ============================
     * ✊ GRAB
     * ============================
     */

    const isGrab = (
        landmarks: Array<{
            x: number;
            y: number;
        }>
    ): boolean => {
        const indexClosed =
            !isFingerExtended(
                landmarks,
                8,
                6
            );

        const middleClosed =
            !isFingerExtended(
                landmarks,
                12,
                10
            );

        const ringClosed =
            !isFingerExtended(
                landmarks,
                16,
                14
            );

        const pinkyClosed =
            !isFingerExtended(
                landmarks,
                20,
                18
            );

        return (
            indexClosed &&
            middleClosed &&
            ringClosed &&
            pinkyClosed
        );
    };


    /**
     * ============================
     * 👋 WAVE
     *
     * 手の形としてWAVEを判定。
     *
     * 手を開いている状態をWAVEとして扱う。
     * 実際のWAVE成立には後述の
     * X軸加速度も必要。
     * ============================
     */

    const isWavePose = (
        landmarks: Array<{
            x: number;
            y: number;
        }>
    ): boolean => {
        const indexOpen =
            isFingerExtended(
                landmarks,
                8,
                6
            );

        const middleOpen =
            isFingerExtended(
                landmarks,
                12,
                10
            );

        const ringOpen =
            isFingerExtended(
                landmarks,
                16,
                14
            );

        const pinkyOpen =
            isFingerExtended(
                landmarks,
                20,
                18
            );

        return (
            indexOpen &&
            middleOpen &&
            ringOpen &&
            pinkyOpen
        );
    };


    /**
     * ============================
     * 生ジェスチャー判定
     *
     * ここでは全て同じGesture型を返す。
     *
     * CUT / SLAMはここでは判定しない。
     * モーション込みの最終判定は後で行う。
     * ============================
     */

    const detectRawGesture = (
        landmarks: Array<{
            x: number;
            y: number;
        }>
    ): Gesture => {
        if (isScissors(landmarks)) {
            return "SCISSORS";
        }

        if (isGrab(landmarks)) {
            return "GRAB";
        }

        if (isWavePose(landmarks)) {
            return "WAVE";
        }

        return "NONE";
    };


    /**
     * ============================
     * 5フレーム多数決
     *
     * 例:
     *
     * GRAB
     * GRAB
     * SCISSORS
     * GRAB
     * GRAB
     *
     * ↓
     *
     * GRAB
     * ============================
     */

    const getMajorityGesture = (
        history: GestureFrame[]
    ): Gesture | null => {
        if (history.length < GESTURE_HISTORY_SIZE) {
            return null;
        }

        const counts: Record<Gesture, number> = {
            NONE: 0,
            SCISSORS: 0,
            GRAB: 0,
            WAVE: 0,
            CUT: 0,
            SLAM: 0,
        };

        for (const frame of history) {
            counts[frame.gesture]++;
        }

        let winner: Gesture = "NONE";
        let maxCount = 0;

        const gestures: Gesture[] = [
            "NONE",
            "SCISSORS",
            "GRAB",
            "WAVE",
            "CUT",
            "SLAM",
        ];

        for (const item of gestures) {
            if (counts[item] > maxCount) {
                maxCount = counts[item];
                winner = item;
            }
        }

        if (maxCount >= MAJORITY_COUNT) {
            return winner;
        }

        return null;
    };


    /**
     * ============================
     * 手のひら中心
     * ============================
     */

    const getPalmCenter = (
        landmarks: Array<{
            x: number;
            y: number;
        }>,
        time: number
    ): Point => {
        const wrist = landmarks[0];
        const middleBase = landmarks[9];

        return {
            x:
                (wrist.x + middleBase.x) /
                2,
            y:
                (wrist.y + middleBase.y) /
                2,
            time,
        };
    };


    /**
     * ============================
     * 速度・加速度
     *
     * vx = X方向速度
     * vy = Y方向速度
     *
     * acceleration =
     * 現在の速度 - 前回の速度
     * ============================
     */

    const calculateAcceleration = () => {
        const history =
            motionHistoryRef.current;

        if (history.length < 3) {
            return {
                ax: 0,
                ay: 0,
            };
        }

        const current =
            history[history.length - 1];

        const previous =
            history[history.length - 2];

        const previousPrevious =
            history[history.length - 3];

        const dt1 =
            current.time -
            previous.time;

        const dt2 =
            previous.time -
            previousPrevious.time;

        if (
            dt1 <= 0 ||
            dt2 <= 0
        ) {
            return {
                ax: 0,
                ay: 0,
            };
        }

        /**
         * 現在の速度
         */
        const vx =
            (current.x - previous.x) /
            dt1;

        const vy =
            (current.y - previous.y) /
            dt1;

        /**
         * 前回の速度
         */
        const previousVx =
            (previous.x -
                previousPrevious.x) /
            dt2;

        const previousVy =
            (previous.y -
                previousPrevious.y) /
            dt2;

        /**
         * 加速度
         */
        const ax =
            (vx - previousVx) /
            dt1;

        const ay =
            (vy - previousVy) /
            dt1;

        return {
            ax,
            ay,
        };
    };


    /**
     * ============================
     * ✂️ CUT
     *
     * SCISSORS多数決
     * +
     * X軸加速度
     * ============================
     */

    const detectCut = (
        majorityGesture: Gesture,
        ax: number,
        now: number
    ): boolean => {
        if (
            majorityGesture !==
            "SCISSORS"
        ) {
            return false;
        }

        if (
            now -
            lastCutTimeRef.current <
            CUT_COOLDOWN_MS
        ) {
            return false;
        }

        /**
         * X軸の加速度の絶対値を見る。
         *
         * 左右どちらでもOK。
         */
        if (
            Math.abs(ax) <
            CUT_MIN_ACCELERATION
        ) {
            return false;
        }

        lastCutTimeRef.current = now;

        return true;
    };


    /**
     * ============================
     * 💥 SLAM
     *
     * GRAB多数決
     * +
     * Y軸加速度
     *
     * Yは下方向がプラス。
     *
     * そのため「下方向の加速度」
     * を見る。
     * ============================
     */

    const detectSlam = (
        majorityGesture: Gesture,
        ay: number,
        now: number
    ): boolean => {
        if (
            majorityGesture !==
            "GRAB"
        ) {
            return false;
        }

        if (
            now -
            lastSlamTimeRef.current <
            SLAM_COOLDOWN_MS
        ) {
            return false;
        }

        /**
         * 下方向の加速度のみ。
         *
         * MediaPipeのY座標は
         * 下に行くほど大きくなる。
         */
        if (
            ay <
            SLAM_MIN_ACCELERATION
        ) {
            return false;
        }

        lastSlamTimeRef.current =
            now;

        return true;
    };


    /**
     * ============================
     * 👋 WAVE
     *
     * WAVE多数決
     * +
     * X軸加速度
     * ============================
     */

    const detectWave = (
        majorityGesture: Gesture,
        ax: number,
        now: number
    ): boolean => {
        if (
            majorityGesture !==
            "WAVE"
        ) {
            return false;
        }

        if (
            now -
            lastWaveTimeRef.current <
            WAVE_COOLDOWN_MS
        ) {
            return false;
        }

        if (
            Math.abs(ax) <
            WAVE_MIN_ACCELERATION
        ) {
            return false;
        }

        lastWaveTimeRef.current =
            now;

        return true;
    };


    /**
     * ============================
     * MediaPipe初期化
     * ============================
     */

    const initializeHandLandmarker =
        async () => {
            try {
                setStatus(
                    "MediaPipeを読み込み中..."
                );

                const vision =
                    await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
                    );

                const handLandmarker =
                    await HandLandmarker.createFromOptions(
                        vision,
                        {
                            baseOptions: {
                                modelAssetPath:
                                    "/models/hand_landmarker.task",

                                delegate: "GPU",
                            },

                            runningMode: "VIDEO",

                            numHands: 1,

                            minHandDetectionConfidence:
                                0.5,

                            minHandPresenceConfidence:
                                0.5,

                            minTrackingConfidence:
                                0.5,
                        }
                    );

                handLandmarkerRef.current =
                    handLandmarker;

                setStatus(
                    "カメラを起動中..."
                );

                await startCamera();
            } catch (error) {
                console.error(
                    "HandLandmarker initialization error:",
                    error
                );

                setStatus(
                    "初期化に失敗しました"
                );
            }
        };


    /**
     * ============================
     * カメラ起動
     * ============================
     */

    const startCamera =
        async () => {
            try {
                const stream =
                    await navigator.mediaDevices.getUserMedia(
                        {
                            video: {
                                facingMode: "user",

                                width: {
                                    ideal: 1280,
                                },

                                height: {
                                    ideal: 720,
                                },
                            },

                            audio: false,
                        }
                    );

                streamRef.current =
                    stream;

                const video =
                    videoRef.current;

                if (!video) {
                    return;
                }

                video.srcObject =
                    stream;

                await video.play();

                setStatus(
                    "認識中"
                );

                startDetectionLoop();
            } catch (error) {
                console.error(
                    "Camera error:",
                    error
                );

                setStatus(
                    "カメラを起動できませんでした"
                );
            }
        };


    /**
     * ============================
     * 検出ループ
     * ============================
     */

    const startDetectionLoop =
        () => {
            const detect = () => {
                const video =
                    videoRef.current;

                const canvas =
                    canvasRef.current;

                const handLandmarker =
                    handLandmarkerRef.current;

                if (
                    !video ||
                    !canvas ||
                    !handLandmarker
                ) {
                    animationFrameRef.current =
                        requestAnimationFrame(
                            detect
                        );

                    return;
                }

                const now =
                    performance.now();

                /**
                 * 約20FPS
                 */
                if (
                    now -
                    lastDetectionTimeRef.current >=
                    DETECTION_INTERVAL
                ) {
                    lastDetectionTimeRef.current =
                        now;

                    try {
                        if (
                            video.readyState >= 2
                        ) {
                            const result =
                                handLandmarker.detectForVideo(
                                    video,
                                    now
                                );

                            const ctx =
                                canvas.getContext(
                                    "2d"
                                );

                            if (!ctx) {
                                return;
                            }

                            /**
                             * Canvasサイズ
                             */
                            if (
                                canvas.width !==
                                video.videoWidth ||
                                canvas.height !==
                                video.videoHeight
                            ) {
                                canvas.width =
                                    video.videoWidth;

                                canvas.height =
                                    video.videoHeight;
                            }

                            ctx.clearRect(
                                0,
                                0,
                                canvas.width,
                                canvas.height
                            );


                            /**
                             * ======================
                             * 手がある
                             * ======================
                             */

                            if (
                                result.landmarks &&
                                result.landmarks.length >
                                0
                            ) {
                                const landmarks =
                                    result.landmarks[0];


                                /**
                                 * ランドマーク描画
                                 */
                                const drawingUtils =
                                    new DrawingUtils(
                                        ctx
                                    );

                                drawingUtils.drawConnectors(
                                    landmarks,
                                    HandLandmarker.HAND_CONNECTIONS,
                                    {
                                        lineWidth: 3,
                                    }
                                );

                                drawingUtils.drawLandmarks(
                                    landmarks,
                                    {
                                        radius: 4,
                                    }
                                );


                                /**
                                 * ======================
                                 * 1. 手の位置
                                 * ======================
                                 */

                                const palm =
                                    getPalmCenter(
                                        landmarks,
                                        now
                                    );

                                motionHistoryRef.current.push(
                                    palm
                                );


                                /**
                                 * 古い位置を削除
                                 */
                                motionHistoryRef.current =
                                    motionHistoryRef.current.filter(
                                        (point) =>
                                            now -
                                            point.time <=
                                            MOTION_HISTORY_MS
                                    );


                                /**
                                 * ======================
                                 * 2. 加速度
                                 * ======================
                                 */

                                const {
                                    ax,
                                    ay,
                                } =
                                    calculateAcceleration();


                                /**
                                 * ======================
                                 * 3. 生ジェスチャー
                                 * ======================
                                 */

                                const rawGesture =
                                    detectRawGesture(
                                        landmarks
                                    );


                                /**
                                 * ======================
                                 * 4. 5フレーム履歴
                                 * ======================
                                 */

                                gestureHistoryRef.current.push(
                                    {
                                        gesture:
                                            rawGesture,

                                        time: now,
                                    }
                                );


                                if (
                                    gestureHistoryRef.current
                                        .length >
                                    GESTURE_HISTORY_SIZE
                                ) {
                                    gestureHistoryRef.current.shift();
                                }


                                /**
                                 * ======================
                                 * 5. 多数決
                                 * ======================
                                 */

                                const majorityGesture =
                                    getMajorityGesture(
                                        gestureHistoryRef.current
                                    );


                                /**
                                 * まだ5枚ない
                                 */
                                if (
                                    !majorityGesture
                                ) {
                                    setGesture(
                                        rawGesture
                                    );

                                    animationFrameRef.current =
                                        requestAnimationFrame(
                                            detect
                                        );

                                    return;
                                }


                                /**
                                 * ======================
                                 * 6. CUT
                                 * ======================
                                 */

                                if (
                                    detectCut(
                                        majorityGesture,
                                        ax,
                                        now
                                    )
                                ) {
                                    setGesture(
                                        "CUT"
                                    );

                                    console.log(
                                        "✂️ CUT"
                                    );

                                    animationFrameRef.current =
                                        requestAnimationFrame(
                                            detect
                                        );

                                    return;
                                }


                                /**
                                 * ======================
                                 * 7. SLAM
                                 * ======================
                                 */

                                if (
                                    detectSlam(
                                        majorityGesture,
                                        ay,
                                        now
                                    )
                                ) {
                                    setGesture(
                                        "SLAM"
                                    );

                                    console.log(
                                        "💥 SLAM"
                                    );

                                    animationFrameRef.current =
                                        requestAnimationFrame(
                                            detect
                                        );

                                    return;
                                }


                                /**
                                 * ======================
                                 * 8. WAVE
                                 * ======================
                                 */

                                if (
                                    detectWave(
                                        majorityGesture,
                                        ax,
                                        now
                                    )
                                ) {
                                    setGesture(
                                        "WAVE"
                                    );

                                    console.log(
                                        "👋 WAVE"
                                    );

                                    animationFrameRef.current =
                                        requestAnimationFrame(
                                            detect
                                        );

                                    return;
                                }


                                /**
                                 * ======================
                                 * 9. 通常ジェスチャー
                                 * ======================
                                 */

                                setGesture(
                                    majorityGesture
                                );
                            } else {
                                /**
                                 * ======================
                                 * 手がない
                                 * ======================
                                 */

                                motionHistoryRef.current =
                                    [];

                                velocityHistoryRef.current =
                                    [];

                                gestureHistoryRef.current.push(
                                    {
                                        gesture:
                                            "NONE",

                                        time: now,
                                    }
                                );

                                if (
                                    gestureHistoryRef.current
                                        .length >
                                    GESTURE_HISTORY_SIZE
                                ) {
                                    gestureHistoryRef.current.shift();
                                }

                                const majorityGesture =
                                    getMajorityGesture(
                                        gestureHistoryRef.current
                                    );

                                if (
                                    majorityGesture
                                ) {
                                    setGesture(
                                        majorityGesture
                                    );
                                }
                            }
                        }
                    } catch (error) {
                        /**
                         * 一時的なMediaPipeエラーで
                         * アプリ全体が落ちないようにする。
                         */
                        console.error(
                            "Hand detection error:",
                            error
                        );
                    }
                }

                animationFrameRef.current =
                    requestAnimationFrame(
                        detect
                    );
            };

            animationFrameRef.current =
                requestAnimationFrame(
                    detect
                );
        };


    /**
     * ============================
     * 初期化・後始末
     * ============================
     */

    useEffect(() => {
        initializeHandLandmarker();

        return () => {
            /**
             * AnimationFrame停止
             */
            if (
                animationFrameRef.current !==
                null
            ) {
                cancelAnimationFrame(
                    animationFrameRef.current
                );

                animationFrameRef.current =
                    null;
            }

            /**
             * カメラ停止
             */
            if (
                streamRef.current
            ) {
                streamRef.current
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );

                streamRef.current =
                    null;
            }

            /**
             * MediaPipe停止
             */
            if (
                handLandmarkerRef.current
            ) {
                handLandmarkerRef.current.close();

                handLandmarkerRef.current =
                    null;
            }
        };
    }, []);


    /**
     * ============================
     * 表示
     * ============================
     */

    const gestureLabel: Record<
        Gesture,
        string
    > = {
        NONE: "待機中",
        SCISSORS: "✌️ SCISSORS",
        GRAB: "✊ GRAB",
        WAVE: "👋 WAVE",
        CUT: "✂️ CUT!",
        SLAM: "💥 SLAM!",
    };


    return (
        <div className="flex min-h-screen flex-col items-center gap-6 bg-black p-6 text-white">
            <div className="text-center">
                <h1 className="text-3xl font-bold">
                    Code Jenga
                </h1>

                <p className="mt-2 text-sm text-zinc-400">
                    カメラで手のジェスチャーを認識
                </p>
            </div>


            <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="block h-auto w-full scale-x-[-1]"
                />

                <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                />


                <div className="absolute left-4 top-4 rounded-lg bg-black/70 px-4 py-2 backdrop-blur">
                    <div className="text-xs text-zinc-400">
                        STATUS
                    </div>

                    <div className="text-sm font-medium">
                        {status}
                    </div>
                </div>


                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-black/80 px-6 py-3 backdrop-blur">
                    <div className="text-center text-xs text-zinc-400">
                        GESTURE
                    </div>

                    <div className="mt-1 text-2xl font-bold">
                        {gestureLabel[gesture]}
                    </div>
                </div>
            </div>


            <div className="grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-5">
                <GestureCard
                    emoji="✌️"
                    title="SCISSORS"
                    description="チョキ"
                />

                <GestureCard
                    emoji="✊"
                    title="GRAB"
                    description="握る"
                />

                <GestureCard
                    emoji="👋"
                    title="WAVE"
                    description="開いた手 + X加速度"
                />

                <GestureCard
                    emoji="✂️"
                    title="CUT"
                    description="チョキ + X加速度"
                />

                <GestureCard
                    emoji="💥"
                    title="SLAM"
                    description="握る + Y加速度"
                />
            </div>


            <div className="max-w-3xl text-center text-xs leading-6 text-zinc-500">
                <p>
                    全ジェスチャーを直近5フレームの多数決で判定します。
                </p>

                <p>
                    CUTはSCISSORS + X軸加速度、
                    SLAMはGRAB + Y軸加速度、
                    WAVEはWAVE + X軸加速度です。
                </p>
            </div>
        </div>
    );
}


/**
 * ============================
 * ジェスチャーカード
 * ============================
 */

function GestureCard({
    emoji,
    title,
    description,
}: {
    emoji: string;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <div className="text-3xl">
                {emoji}
            </div>

            <div className="mt-2 text-sm font-bold">
                {title}
            </div>

            <div className="mt-1 text-xs text-zinc-500">
                {description}
            </div>
        </div>
    );
}