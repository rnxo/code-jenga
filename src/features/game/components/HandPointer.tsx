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
//
// 1手を手だけで終えられるようにしてある。
//   1回目のつまみ … その行を選ぶ
//   選んだ行をもう一度つまむ … 削除を確定する
// 確定は「この行を削除する」ボタンを実際に押す形にしている。ボタンは縛りや
// 送信中で disabled になるので、その判断をこちらで持たずに済む。
//
// ボタンを直接つまむこともできるが、盤面が縦に長いとボタンは画面の外にあり、
// 指先は画面の中しか指せない。だから「選んだ行をもう一度つまむ」が主な道。

/** 木片が自分の行番号を名乗る属性。JengaTower 側で付けている */
export const LINE_NO_ATTRIBUTE = "data-line-no";
/**
 * つまんで押せるボタンの印。
 * 行を選んだあとの「この行を削除する」まで手で辿り着けるようにするためのもの。
 */
export const HAND_TARGET_ATTRIBUTE = "data-hand-target";

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

    if (disabledRef.current) {
      if (cursor) {
        cursor.dataset.visible = "false";
      }
      // ねらわせない間につまみ時間を溜めない。溜めたままだと、手番が戻った
      // 最初のフレームで、たまたま指が乗っている行が猶予なしに選ばれる
      resetPinch();
      report(aimedRef, onAimRef, null);
      return;
    }

    if (!frame.visible) {
      // 手を見失っただけ。ここでためを捨てると、検出が一瞬すべるたびに
      // 振り出しに戻る。猶予の判断は hand-tracking 側が持っている
      if (cursor) {
        cursor.dataset.visible = "false";
      }
      report(aimedRef, onAimRef, null);
      return;
    }

    if (cursor) {
      cursor.dataset.visible = "true";
      cursor.dataset.pinching = String(frame.pinching);
      cursor.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0)`;
      cursor.style.setProperty("--hold", String(frame.holdProgress));
    }

    const target = targetAt(frame.x, frame.y);
    report(aimedRef, onAimRef, target.kind === "line" ? target.lineNo : null);

    if (cursor) {
      // 次につまんだら何が起きるかで色を変える。
      // confirm ＝ もう一度つまむと消える、select ＝ 選ぶだけ
      cursor.dataset.target =
        target.kind === "button" || (target.kind === "line" && target.isSelected)
          ? "confirm"
          : target.kind === "line"
            ? "select"
            : "none";
    }

    // つまみ切ったら決定。指を離すまで二度目は走らない
    if (target.kind !== "none" && frame.pinching && frame.holdProgress >= 1) {
      consumePinch();
      if (target.kind === "button") {
        target.button.click();
      } else if (target.isSelected) {
        // 選んだ行をもう一度つまんだ ＝ 削除の確定
        pressConfirmButton();
      } else {
        onCommitRef.current(target.lineNo);
      }
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
            {isRunning ? <p className={styles.previewHint}>つまむ→選ぶ／もう一度→削除</p> : null}
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

type HandTarget =
  | { kind: "line"; lineNo: number; isSelected: boolean }
  | { kind: "button"; button: HTMLElement }
  | { kind: "none" };

/** その座標にあるもの。木片か、手で押せる印のついたボタンか、どちらでもないか */
function targetAt(x: number, y: number): HandTarget {
  const element = document.elementFromPoint(x, y);
  if (!element) {
    return { kind: "none" };
  }

  // ボタンを先に見る。ボタンが木片の上に重なっている場面は無いが、
  // 近い将来そうなっても「押す」が優先されるほうが迷わない
  const button = element.closest<HTMLElement>(`[${HAND_TARGET_ATTRIBUTE}]`);
  if (button) {
    return { kind: "button", button };
  }

  const piece = element.closest(`[${LINE_NO_ATTRIBUTE}]`);
  const raw = piece?.getAttribute(LINE_NO_ATTRIBUTE);
  if (!piece || !raw) {
    return { kind: "none" };
  }
  const lineNo = Number.parseInt(raw, 10);
  if (Number.isNaN(lineNo)) {
    return { kind: "none" };
  }
  // 木片自身が「選ばれているか」を知っている（aria-pressed）ので、
  // 選択中の行かどうかを外から渡してもらう必要がない
  return { kind: "line", lineNo, isSelected: piece.getAttribute("aria-pressed") === "true" };
}

/**
 * 「この行を削除する」を押す。画面の外にあっても押せる。
 * 縛りや送信中は disabled なので、click しても何も起きない（その判断はボタン側に任せる）。
 */
function pressConfirmButton(): void {
  document
    .querySelector<HTMLElement>(`[${HAND_TARGET_ATTRIBUTE}="confirm-delete"]`)
    ?.click();
}
