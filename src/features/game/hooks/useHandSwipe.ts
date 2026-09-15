"use client";

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";

const SWIPE_DISTANCE = 0.2;
const MAX_VERTICAL_DRIFT = 0.1;
const MIN_SWIPE_DURATION_MS = 100;
const MAX_SWIPE_DURATION_MS = 700;
const MIN_SAMPLE_COUNT = 4;
const MAX_SAMPLE_DISTANCE = 0.08;
const MIN_DIRECTIONAL_STEP = 0.012;
const MAX_REVERSE_STEP = 0.025;
const SMOOTHING_FACTOR = 0.35;
const SWIPE_COOLDOWN_MS = 900;

export type HandSwipeStatus = "disabled" | "loading" | "ready" | "error";

interface UseHandSwipeOptions {
  enabled: boolean;
  lineCount: number;
  onSwipe: (lineNo: number) => void;
}

interface HandSwipeResult {
  videoRef: React.RefCallback<HTMLVideoElement>;
  status: HandSwipeStatus;
  errorMessage: string | null;
}

export function useHandSwipe({ enabled, lineCount, onSwipe }: UseHandSwipeOptions): HandSwipeResult {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const videoRef: React.RefCallback<HTMLVideoElement> = (video) => {
    videoElementRef.current = video;
  };
  const onSwipeRef = useRef(onSwipe);
  const lineCountRef = useRef(lineCount);
  const [status, setStatus] = useState<HandSwipeStatus>("disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    lineCountRef.current = lineCount;
  }, [lineCount]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let stream: MediaStream | null = null;
    let handLandmarker: HandLandmarker | null = null;
    let swipeStart: { x: number; y: number; timestamp: number } | null = null;
    let lastPoint: { x: number; y: number; timestamp: number } | null = null;
    let swipeDirection: -1 | 1 | null = null;
    let sampleCount = 0;
    let cooldownUntil = 0;

    const resetSwipe = () => {
      swipeStart = null;
      lastPoint = null;
      swipeDirection = null;
      sampleCount = 0;
    };

    const stop = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      stream?.getTracks().forEach((track) => track.stop());
      const video = videoElementRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      handLandmarker?.close();
    };

    const detect = () => {
      if (cancelled || !handLandmarker || !videoElementRef.current) {
        return;
      }

      const video = videoElementRef.current;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const result = handLandmarker.detectForVideo(video, performance.now());
        const indexFinger = result.landmarks[0]?.[8];
        const timestamp = performance.now();

        if (!indexFinger) {
          resetSwipe();
        } else if (!swipeStart || !lastPoint) {
          swipeStart = { x: indexFinger.x, y: indexFinger.y, timestamp };
          lastPoint = { x: indexFinger.x, y: indexFinger.y, timestamp };
          swipeDirection = null;
          sampleCount = 1;
        } else {
          const point = {
            x: lastPoint.x + (indexFinger.x - lastPoint.x) * SMOOTHING_FACTOR,
            y: lastPoint.y + (indexFinger.y - lastPoint.y) * SMOOTHING_FACTOR,
            timestamp,
          };
          const elapsed = timestamp - swipeStart.timestamp;
          const stepDistance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);

          if (elapsed > MAX_SWIPE_DURATION_MS || stepDistance > MAX_SAMPLE_DISTANCE) {
            swipeStart = { ...point };
            lastPoint = { ...point };
            swipeDirection = null;
            sampleCount = 1;
            animationFrameId = requestAnimationFrame(detect);
            return;
          }

          const horizontalStep = point.x - lastPoint.x;
          lastPoint = point;
          sampleCount += 1;
          if (swipeDirection === null && Math.abs(horizontalStep) >= MIN_DIRECTIONAL_STEP) {
            swipeDirection = horizontalStep > 0 ? 1 : -1;
          } else if (
            swipeDirection !== null &&
            swipeDirection * horizontalStep <= -MAX_REVERSE_STEP
          ) {
            resetSwipe();
            animationFrameId = requestAnimationFrame(detect);
            return;
          }
          const horizontalDistance = Math.abs(point.x - swipeStart.x);
          const verticalDistance = Math.abs(point.y - swipeStart.y);
          if (
            horizontalDistance >= SWIPE_DISTANCE &&
            verticalDistance <= MAX_VERTICAL_DRIFT &&
            elapsed >= MIN_SWIPE_DURATION_MS &&
            sampleCount >= MIN_SAMPLE_COUNT &&
            performance.now() >= cooldownUntil
          ) {
            const currentLineCount = lineCountRef.current;
            if (currentLineCount > 0) {
              const lineNo = Math.min(
                currentLineCount,
                Math.max(1, Math.floor(swipeStart.y * currentLineCount) + 1),
              );
              onSwipeRef.current(lineNo);
              cooldownUntil = timestamp + SWIPE_COOLDOWN_MS;
            }
            resetSwipe();
          }
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    const start = async () => {
      try {
        setStatus("loading");
        setErrorMessage(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("このブラウザではカメラ入力を利用できません。");
        }

        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minHandDetectionConfidence: 0.65,
          minHandPresenceConfidence: 0.65,
          minTrackingConfidence: 0.65,
          numHands: 1,
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (cancelled || !videoElementRef.current) {
          stop();
          return;
        }

        videoElementRef.current.srcObject = stream;
        await videoElementRef.current.play();
        setStatus("ready");
        animationFrameId = requestAnimationFrame(detect);
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "カメラ入力を開始できませんでした。");
        }
        stop();
      }
    };

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled]);

  return { videoRef, status, errorMessage };
}