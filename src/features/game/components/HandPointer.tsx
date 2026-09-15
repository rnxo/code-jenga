"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./HandPointer.module.css";
import {
  consumePinch,
  resetPinch,
  getServerStatusSnapshot,
  getStatusSnapshot,
  isHandTrackingSupported,
  startHandTracking,
  stopHandTracking,
  subscribeFrame,
  subscribeStatus,
  type HandFrame,
} from "../hand-tracking";

// カメラに映した手で行をねらう操作。担当: ようた（見た目）
//
// 指先の座標から、その下にある木片（data-line-no を持つ要素）を引く。
// どの行をねらっているかは onAim で親へ返し、親がハイライトを出す。
// 親指と人差し指をつまんだまま少し待つと onCommit（＝その行を選ぶ）。
//
// 指の位置は毎フレーム変わるので、カーソルの移動は ref 経由で直接書く。
// React の state に載せると 3D タワーごと毎フレーム描き直しになる。

/** 木片が自分の行番号を名乗る属性。JengaTower 側で付けている */
export const LINE_NO_ATTRIBUTE = "data-line-no";

/** 値が変わらないものを useSyncExternalStore で読むための、何もしない購読 */
const EMPTY_SUBSCRIBE = () => () => {};
const getFalse = () => false;

export interface HandPointerProps {
  /** ねらっている行番号。外れていれば null */
  onAim: (lineNo: number | null) => void;
  /** つまんだまま待ちきったときに呼ぶ */
  onCommit: (lineNo: number) => void;
  /** 自分の手番でないときなど、ねらわせない状態 */
  disabled?: boolean;
}

export function HandPointer({ onAim, onCommit, disabled = false }: HandPointerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  /** 直前に返した行番号。同じ行のあいだは親を再描画しない */
  const aimedRef = useRef<number | null>(null);

  // カメラの有無はブラウザにしか分からない。描画中に navigator を覗かずに済むよう、
  // 外部ストアとして読む（サーバー側は false ＝ボタンを出さない）。
  const isSupported = useSyncExternalStore(EMPTY_SUBSCRIBE, isHandTrackingSupported, getFalse);
  const { status, message } = useSyncExternalStore(
    subscribeStatus,
    getStatusSnapshot,
    getServerStatusSnapshot,
  );
  const isRunning = status === "running";

  // 最新の props を掴んでおく。フレームの購読は付け外ししたくない
  const onAimRef = useRef(onAim);
  const onCommitRef = useRef(onCommit);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onAimRef.current = onAim;
    onCommitRef.current = onCommit;
    disabledRef.current = disabled;
  });

  const handleFrame = useCallback((frame: HandFrame) => {
    const cursor = cursorRef.current;

    if (!frame.visible || disabledRef.current) {
      if (cursor) {
        cursor.dataset.visible = "false";
      }
      // ねらわせない間につまみ時間を溜めない。溜めたままだと、手番が戻った
      // 最初のフレームで、たまたま指が乗っている行が猶予なしに選ばれる
      resetPinch();
      report(aimedRef, onAimRef, null);
      return;
    }

    if (cursor) {
      cursor.dataset.visible = "true";
      cursor.dataset.pinching = String(frame.pinching);
      cursor.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0)`;
      cursor.style.setProperty("--hold", String(frame.holdProgress));
    }

    const lineNo = lineNoAt(frame.x, frame.y);
    report(aimedRef, onAimRef, lineNo);

    // つまみ切ったら決定。指を離すまで二度目は走らない
    if (lineNo !== null && frame.pinching && frame.holdProgress >= 1) {
      consumePinch();
      onCommitRef.current(lineNo);
    }
  }, []);

  useEffect(() => subscribeFrame(handleFrame), [handleFrame]);

  // 盤面から消えるときはカメラを必ず閉じる（閉じ忘れると録画ランプが点いたままになる）
  useEffect(() => stopHandTracking, []);

  if (!isSupported) {
    return null;
  }

  function handleToggle() {
    if (isRunning || status === "loading") {
      stopHandTracking();
      report(aimedRef, onAimRef, null);
      return;
    }
    const video = videoRef.current;
    if (video) {
      void startHandTracking(video);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={isRunning}
        disabled={status === "loading"}
        onClick={handleToggle}
      >
        {/* 初回は判定モデル（十数 MB）を取りに行くので、待たされることを先に言っておく */}
        {status === "loading"
          ? "読み込み中…（初回は10秒ほど）"
          : isRunning
            ? "手でねらう: オン"
            : "手でねらう"}
      </button>
      {message ? (
        <span role="status" className={styles.error}>
          {message}
        </span>
      ) : null}

      {/*
       * 映像と指先は body 直下に出す。タワーは overflow を持つので、
       * 中に置くと画面の隅に固定したものが切られることがある。
       */}
      {createPortal(
        <>
          {/* 映像は「カメラが生きている」ことを本人に見せるために出す。小さく鏡写しにする */}
          <div className={styles.preview} data-active={isRunning}>
            <video ref={videoRef} className={styles.video} playsInline muted />
            {isRunning ? <p className={styles.previewHint}>つまんで決定</p> : null}
          </div>

          {/* 指先。ポインタを通さないので、下の木片は普通にクリックできる */}
          <div ref={cursorRef} className={styles.cursor} data-visible="false" aria-hidden>
            <span className={styles.cursorRing} />
            <span className={styles.cursorDot} />
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

/** 変わったときだけ親に伝える。毎フレーム呼ぶと盤面が描き直しになる */
function report(
  aimedRef: { current: number | null },
  onAimRef: { current: (lineNo: number | null) => void },
  lineNo: number | null,
) {
  if (aimedRef.current === lineNo) {
    return;
  }
  aimedRef.current = lineNo;
  onAimRef.current(lineNo);
}

/** その座標にある木片の行番号。木片の上でなければ null */
function lineNoAt(x: number, y: number): number | null {
  const element = document.elementFromPoint(x, y);
  const piece = element?.closest(`[${LINE_NO_ATTRIBUTE}]`);
  const raw = piece?.getAttribute(LINE_NO_ATTRIBUTE);
  if (!raw) {
    return null;
  }
  const lineNo = Number.parseInt(raw, 10);
  return Number.isNaN(lineNo) ? null : lineNo;
}
