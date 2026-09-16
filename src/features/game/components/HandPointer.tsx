"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import styles from "./HandPointer.module.css";
import {
  advanceDwell,
  consumeDwell,
  resetDwell,
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

/** 木片が自分の行番号を名乗る属性。JengaTower 側で付けている */
export const LINE_NO_ATTRIBUTE = "data-line-no";
/** 「この行を削除する」ボタンの印。LineDeleteControls 側で付けている */
export const CONFIRM_ATTRIBUTE = "data-hand-confirm";

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
  /** いま色を塗っている木片。別のものへ移ったら消しに戻る */
  const dwelledRef = useRef<HTMLElement | null>(null);

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

    if (disabledRef.current) {
      // ねらわせない間は数えない。溜めたままだと、手番が戻った最初の
      // フレームで、たまたま指が乗っている行が猶予なしに消える
      resetDwell();
      clearAim(cursor, aimedRef, dwelledRef, onAimRef);
      return;
    }

    if (!frame.visible) {
      // 手を見失っただけ。ここで捨てると、検出が一瞬すべるたびに振り出しに
      // 戻る。猶予の判断は advanceDwell 側が持っている
      advanceDwell(null, 0, 0, performance.now());
      clearAim(cursor, aimedRef, dwelledRef, onAimRef);
      return;
    }

    const piece = pieceAt(frame.x, frame.y);
    const progress = advanceDwell(
      piece === null ? null : String(piece.lineNo),
      frame.x,
      frame.y,
      performance.now(),
    );

    if (cursor) {
      cursor.dataset.visible = "true";
      cursor.dataset.target = piece === null ? "none" : "line";
      cursor.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0)`;
      cursor.style.setProperty("--dwell", String(progress));
    }

    // 別の木片へ移ったら、前の木片の色を消す
    if (dwelledRef.current && dwelledRef.current !== piece?.element) {
      paintDwell(dwelledRef.current, null);
      dwelledRef.current = null;
    }
    if (piece) {
      dwelledRef.current = piece.element;
      paintDwell(piece.element, progress);
    }

    report(aimedRef, onAimRef, piece?.lineNo ?? null);

    // 満ちたら削除。その場から離れるまで二度目は走らない
    if (piece !== null && progress >= 1) {
      consumeDwell();
      paintDwell(piece.element, null);
      // 先に行を選ぶ。ボタンが押せるようになるのを待ってから確定する
      onCommitRef.current(piece.lineNo);
      pressConfirmButton();
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
            {isRunning ? <p className={styles.previewHint}>指を止めると削除</p> : null}
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

/** 狙いを解く。カーソルを隠し、塗っていた木片の色も消す */
function clearAim(
  cursor: HTMLElement | null,
  aimedRef: { current: number | null },
  dwelledRef: { current: HTMLElement | null },
  onAimRef: { current: (lineNo: number | null) => void },
) {
  if (cursor) {
    cursor.dataset.visible = "false";
  }
  paintDwell(dwelledRef.current, null);
  dwelledRef.current = null;
  report(aimedRef, onAimRef, null);
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

/** その座標にある木片。木片の上でなければ null */
function pieceAt(x: number, y: number): { element: HTMLElement; lineNo: number } | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>(`[${LINE_NO_ATTRIBUTE}]`);
  const raw = element?.getAttribute(LINE_NO_ATTRIBUTE);
  if (!element || !raw) {
    return null;
  }
  const lineNo = Number.parseInt(raw, 10);
  return Number.isNaN(lineNo) ? null : { element, lineNo };
}

/** ボタンが押せるようになるのを待つ上限。これを過ぎたら諦める */
const CONFIRM_WAIT_MS = 300;

/**
 * 「この行を削除する」を押す。画面の外にあっても押せる。
 *
 * 削除できるかどうか（縛り・送信中）はボタンの disabled が持っているので、
 * click するだけにして、その判断をこちらで抱えない。
 *
 * 行を選んだ直後は、React がまだ描き直しておらずボタンが disabled のことが
 * ある。数フレームだけ待って押す。縛りで本当に押せない行なら、待っても
 * disabled のままなので、そのまま諦める（連打にはならない）。
 */
function pressConfirmButton(startedAt = performance.now()): void {
  const button = document.querySelector<HTMLButtonElement>(`[${CONFIRM_ATTRIBUTE}]`);
  if (button && !button.disabled) {
    button.click();
    return;
  }
  if (performance.now() - startedAt < CONFIRM_WAIT_MS) {
    requestAnimationFrame(() => pressConfirmButton(startedAt));
  }
}

/** 木片に溜まり具合を書く。消すときは null を渡す */
function paintDwell(element: HTMLElement | null, progress: number | null): void {
  if (!element) {
    return;
  }
  if (progress === null) {
    element.style.removeProperty("--dwell");
    delete element.dataset.dwelling;
    return;
  }
  element.dataset.dwelling = "true";
  element.style.setProperty("--dwell", String(progress));
}
