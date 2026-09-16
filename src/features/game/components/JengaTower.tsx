"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import styles from "./JengaTower.module.css";
import { playCollapseSound } from "../collapse-sound";
import {
  getServerSoundMuted,
  isSoundMuted,
  subscribeSoundMuted,
  toggleSoundMuted,
} from "../sound-settings";
import { CollapseMonuments, type CollapseVerdict } from "./CollapseMonuments";
import { HandPointer, LINE_NO_ATTRIBUTE } from "./HandPointer";

// コードを 3D の積み木として見せる盤面。担当: FE-B
//
// current_code を行に割り、1行を1つの木片として積む。文字は前面にだけ置くので
// 立体にしても読みやすさは落ちない。ドラッグでタワーごと回せる。
// 直前の判定がアウトなら、段ごとに時間差で崩れ落ちる。

/** 木口の色。段ごとに変えて、木を積んでいるように見せる */
const FACE_COLORS = ["#d97706", "#b45309", "#c2620a", "#a8480a"] as const;

const DEFAULT_RX = 4;
const DEFAULT_RY = -14;

/**
 * 行数ごとの詰め方。行数が多いお題でもタワー全体が一目で見えるようにする。
 * 縦スクロールにしないのは、ドラッグ回転と操作が競合するため。
 * 読む用途は下の CodeViewer が担うので、こちらは全体像を優先する。
 */
/**
 * perLine は「その詰め方での1段ぶんの高さ（木片＋隙間）」の実測値。
 * 何行でどれだけの高さになるかを、DOM を測らずに見積もるために持つ。
 */
const DENSITY_STEPS = [
  { maxLines: 10, minHeight: "44px", padding: "0.5rem 0.75rem", fontSize: "13px", lineHeight: "1.5", gap: "0.75rem", perLine: 65 },
  { maxLines: 16, minHeight: "36px", padding: "0.375rem 0.75rem", fontSize: "12px", lineHeight: "1.5", gap: "0.5rem", perLine: 53 },
  { maxLines: 24, minHeight: "30px", padding: "0.25rem 0.625rem", fontSize: "11px", lineHeight: "1.4", gap: "0.375rem", perLine: 44 },
  { maxLines: 34, minHeight: "24px", padding: "0.125rem 0.5rem", fontSize: "10px", lineHeight: "1.3", gap: "0.25rem", perLine: 36 },
  { maxLines: 44, minHeight: "20px", padding: "0 0.5rem", fontSize: "10px", lineHeight: "1.2", gap: "3px", perLine: 30 },
  { maxLines: Infinity, minHeight: "16px", padding: "0 0.4rem", fontSize: "9px", lineHeight: "1.15", gap: "2px", perLine: 25 },
] as const;

/**
 * タワーがこれ以上高くなるなら縮める。
 *
 * タワーは内部スクロールしない（ドラッグ回転と competing するため）ので、
 * 行数が増えるとそのままページが下に伸び、削除ボタンや判定が画面外へ行く。
 * Brainfuck のお題は 15〜50 行あり、詰めるだけでは 50 行で 1250px 残る。
 */
const MAX_TOWER_PX = 900;
/** これ以上小さくすると、木片が積み木に見えなくなる */
const MIN_ZOOM = 0.6;

/**
 * 行数から縮小率を出す。zoom はレイアウトの高さごと縮むので、
 * transform: scale と違ってページの下の要素がちゃんと上がってくる。
 */
function towerZoom(lineCount: number, step: (typeof DENSITY_STEPS)[number]): number {
  const naturalHeight = lineCount * step.perLine;
  if (naturalHeight <= MAX_TOWER_PX) {
    return 1;
  }
  return Math.max(MIN_ZOOM, MAX_TOWER_PX / naturalHeight);
}

function densityStyle(lineCount: number): CSSProperties {
  const step =
    DENSITY_STEPS.find((candidate) => lineCount <= candidate.maxLines) ??
    DENSITY_STEPS[DENSITY_STEPS.length - 1];
  return {
    "--piece-min-height": step.minHeight,
    "--piece-padding": step.padding,
    "--piece-font-size": step.fontSize,
    "--piece-line-height": step.lineHeight,
    "--tower-gap": step.gap,
    "--tower-zoom": towerZoom(lineCount, step),
  } as CSSProperties;
}

/** これ以上動いたらクリックではなくドラッグと見なす */
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface JengaTowerProps {
  /** games.current_code。行単位に割って積む */
  code: string;
  /** 選択中の行番号（1始まり）。未選択なら null */
  selectedLineNo: number | null;
  onSelectLine: (lineNo: number) => void;
  /** 自分の手番のときだけ行を選べる */
  interactive: boolean;
  /** 直前の判定がアウト／タイムアウトなら崩す */
  collapsed: boolean;
  /** 効果音を鳴らさない。盤面で既に鳴っている結果画面などで使う */
  silent?: boolean;
  /** 見ている人の勝敗。崩壊後の像に勝ち／負けを持たせる */
  verdict?: CollapseVerdict | null;
  /**
   * 崩れ方を詰める。盤面では派手に散らしたいが、終了画面では
   * 「崩れたあとの山」として枠に収めたいので、そちらで使う。
   */
  compact?: boolean;
  /**
   * 外からねらっている行を渡す口（#44 のカメラのスワイプなど）。
   * 渡さなければ、下の HandPointer が見つけた行を自分で使う。
   * selectedLineNo（確定した選択）とは別で、こちらは「いまここを指している」の下見。
   */
  aimedLineNo?: number | null;
}

export function JengaTower({
  code,
  selectedLineNo,
  onSelectLine,
  interactive,
  collapsed,
  silent = false,
  verdict = null,
  compact = false,
  aimedLineNo,
}: JengaTowerProps) {
  const lines = code.length > 0 ? code.split("\n") : [];

  // ドラッグで回す。文字が読めなくなるところまでは倒せないようにする。
  //
  // 木片がタワーの表面をほぼ覆うので、ボタンの上でも掴めるようにしてある。
  // 代わりに「一定距離動いたらドラッグ」と見なし、そのときだけクリックを捨てる。
  const [angle, setAngle] = useState({ rx: DEFAULT_RX, ry: DEFAULT_RY });
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<DragState | null>(null);
  /** 直前のポインタ操作がドラッグだったか。クリックを無視する判断に使う */
  const didDrag = useRef(false);
  /**
   * 効果音を切る。その場かぎりの設定なのは前と同じだが、置き場所は画面の外に出した。
   * セクションを叩いたときの音（silly-sounds）も同じスイッチで黙る。
   */
  const isMuted = useSyncExternalStore(subscribeSoundMuted, isSoundMuted, getServerSoundMuted);
  /** 同じ崩壊で二度鳴らさないための記録 */
  const playedCollapse = useRef(false);
  /**
   * カメラの手でねらっている行。選択（selectedLineNo）とは別物で、
   * 「いまここを指している」という下見の表示にだけ使う。
   * 外から aimedLineNo を渡されたらそちらを優先する。
   */
  const [ownAimedLineNo, setOwnAimedLineNo] = useState<number | null>(null);
  const aimed = aimedLineNo !== undefined ? aimedLineNo : ownAimedLineNo;

  useEffect(() => {
    if (!collapsed) {
      playedCollapse.current = false;
      return;
    }
    if (playedCollapse.current || isMuted || silent) {
      return;
    }
    playedCollapse.current = true;
    playCollapseSound(lines.length);
  }, [collapsed, isMuted, silent, lines.length]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // 左ボタン（タッチ・ペンの主接触）以外では掴まない。右クリックはコンテキスト
    // メニューが開いて pointerup が来ないため、掴むと次の操作を1回食ってしまう
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    // すでに別の指で回している場合は、そちらを優先する
    if (drag.current) {
      return;
    }

    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ...angle,
    };
    didDrag.current = false;

    // ここでは捕捉しない。捕捉すると click がこの要素に付け替えられてしまい、
    // 積み木（button）の onClick が実マウスで一切呼ばれなくなる。
    // 捕捉は「回転が始まった」と判断できた時点（閾値超え）で行う。
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    // 掴んだ指以外の動きは無視する（2本指で触っても回転が死なない）
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;

    if (!didDrag.current) {
      // ここでの閾値は「クリックとみなすか回転とみなすか」の分岐にだけ使う
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      didDrag.current = true;
      setIsDragging(true);
      window.getSelection()?.removeAllRanges();
      // ここから先はドラッグ。要素外で指を離しても pointerup を取りこぼさないよう捕捉する
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setAngle({
      ry: clamp(origin.ry + dx * 0.35, -55, 55),
      rx: clamp(origin.rx - dy * 0.25, -10, 40),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  /** 捕捉を失ったときの保険。これが無いと掴んだままになる経路が残る */
  function handleLostPointerCapture() {
    drag.current = null;
    setIsDragging(false);
  }

  /**
   * まだ捕捉していない（＝回転が始まっていない）うちに外へ出た場合の保険。
   * そのまま外で指を離すと pointerup を取りこぼし、drag.current が残って
   * 次の操作を受け付けなくなる。
   */
  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (didDrag.current) {
      return;
    }
    const origin = drag.current;
    if (origin && origin.pointerId === event.pointerId) {
      drag.current = null;
    }
  }

  function handleSelectLine(lineNo: number, isFromPointer: boolean) {
    // 回したあとの指離しをクリックとして拾わない。
    // キーボード（Enter / Space）の click は detail が 0 なので対象外にする
    if (isFromPointer && didDrag.current) {
      didDrag.current = false;
      return;
    }
    onSelectLine(lineNo);
  }

  if (lines.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">お題コードがまだありません。</p>;
  }

  const isRotated = angle.rx !== DEFAULT_RX || angle.ry !== DEFAULT_RY;

  const towerClassName = [
    styles.tower,
    isDragging ? styles.towerDragging : "",
    !isDragging && !collapsed ? styles.towerIdle : "",
    compact ? styles.towerCompact : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      // 叩いたら鳴る音（#50）。積み木なので、ばね
      data-silly-sound="boing"
      className={[styles.scene, compact ? styles.sceneCompact : ""].filter(Boolean).join(" ")}
      style={{ paddingTop: compact ? 8 : 24, paddingBottom: collapsed && !compact ? 176 : 24 }}
    >
      {/* 崩壊後のおまけ。瓦礫の奥からせり上がってくる */}
      {collapsed ? <CollapseMonuments compact={compact} verdict={verdict} /> : null}

      {/* 崩壊の光。奥から差してくる演出で、崩れているあいだだけ出す */}
      {collapsed ? (
        <div
          aria-hidden
          className={[styles.burst, compact ? "" : styles.burstFullscreen]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={styles.burstVeil} />
          <span className={styles.burstRays} />
          <span className={styles.burstGlow} />
          <span className={styles.burstFlash} />
        </div>
      ) : null}

      <div
        className={towerClassName}
        style={
          {
            "--rx": `${angle.rx}deg`,
            "--ry": `${angle.ry}deg`,
            ...densityStyle(lines.length),
          } as CSSProperties
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onLostPointerCapture={handleLostPointerCapture}
      >
        {lines.map((line, index) => {
          const lineNo = index + 1;
          const isBlank = line.trim().length === 0;
          const isSelected = selectedLineNo === lineNo;
          const isAimed = aimed === lineNo && !isSelected;
          // 空行も正当な手なので選べる（DB_DESIGN.md 10章「空行の削除は禁止していない」）
          const canSelect = interactive && !collapsed;

          const className = [
            styles.piece,
            isBlank ? styles.pieceBlank : "",
            canSelect ? styles.pieceSelectable : "",
            isSelected ? styles.pieceSelected : "",
            isAimed ? styles.pieceAimed : "",
            collapsed ? styles.pieceFalling : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={lineNo}
              type="button"
              className={className}
              // 手でねらう操作が、指先の下にある木片を引くのに使う
              {...{ [LINE_NO_ATTRIBUTE]: lineNo }}
              // disabled にすると pointer イベントが出ず、相手の手番で回転も
              // 文字選択もできなくなる（#2）。押せないことは aria で伝える
              aria-disabled={!canSelect}
              aria-pressed={isSelected}
              aria-label={`${lineNo} 行目: ${isBlank ? "空行" : line}`}
              onClick={(event) => {
                if (!canSelect) {
                  return;
                }
                handleSelectLine(lineNo, event.detail > 0);
              }}
              style={fallStyle(index, lines.length, compact)}
            >
              {/* 回したときに中が抜けないよう、見えない面も置く */}
              <span className={`${styles.face} ${styles.top}`} />
              <span className={`${styles.face} ${styles.bottom}`} />
              <span className={`${styles.face} ${styles.side}`} />
              <span className={`${styles.face} ${styles.side} ${styles.sideLeft}`} />
              <span className={`${styles.face} ${styles.back}`} />

              <span className={`${styles.face} ${styles.front}`}>
                <span className={styles.lineNo}>{String(lineNo).padStart(2, "0")}</span>
                <span className={styles.lineText}>{line}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!collapsed ? (
        <p className={styles.hint}>
          {interactive ? "削除する行をクリック · ドラッグで回転" : "ドラッグで回転"}
          {isRotated ? (
            <>
              {" · "}
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => setAngle({ rx: DEFAULT_RX, ry: DEFAULT_RY })}
              >
                正面に戻す
              </button>
            </>
          ) : null}
          {" · "}
          <button
            type="button"
            className={styles.resetButton}
            data-no-silly
            aria-pressed={isMuted}
            onClick={toggleSoundMuted}
          >
            {isMuted ? "効果音オフ" : "効果音オン"}
          </button>
          {" · "}
          <HandPointer
            disabled={!interactive}
            onAim={setOwnAimedLineNo}
            onCommit={onSelectLine}
          />
        </p>
      ) : null}
    </div>
  );
}

/** 崩れ方は段ごとに散らす（見た目だけなので index から決める）。上の段ほど遠くまで落ちる */
function fallStyle(index: number, total: number, compact: boolean): CSSProperties {
  // 終了画面では同じ向きのまま距離だけ詰めて、山として枠に収める
  const spread = compact ? 0.34 : 1;

  return {
    "--face": FACE_COLORS[index % FACE_COLORS.length],
    "--fall-x": `${((index % 3) - 1) * 46 * spread}px`,
    "--fall-y": `${(40 + (total - index) * 16) * spread}px`,
    "--fall-z": `${((index % 4) - 1) * 44 * spread}px`,
    "--fall-rx": `${26 + (index % 3) * 22}deg`,
    "--fall-rz": `${((index % 5) - 2) * 14}deg`,
    "--fall-delay": `${index * 45}ms`,
  } as CSSProperties;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
