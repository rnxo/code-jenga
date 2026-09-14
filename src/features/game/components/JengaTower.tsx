"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./JengaTower.module.css";

// コードを 3D の積み木として見せる盤面。担当: FE-B
//
// current_code を行に割り、1行を1つの木片として積む。文字は前面にだけ置くので
// 立体にしても読みやすさは落ちない。ドラッグでタワーごと回せる。
// 直前の判定がアウトなら、段ごとに時間差で崩れ落ちる。

/** 木口の色。段ごとに変えて、木を積んでいるように見せる */
const FACE_COLORS = ["#d97706", "#b45309", "#c2620a", "#a8480a"] as const;

const DEFAULT_RX = 4;
const DEFAULT_RY = -14;

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
}

export function JengaTower({
  code,
  selectedLineNo,
  onSelectLine,
  interactive,
  collapsed,
}: JengaTowerProps) {
  const lines = code.length > 0 ? code.split("\n") : [];

  // ドラッグで回す。文字が読めなくなるところまでは倒せないようにする
  const [angle, setAngle] = useState({ rx: DEFAULT_RX, ry: DEFAULT_RY });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // 木片の上では掴まない。捕捉すると木片に click が届かなくなる
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    dragOrigin.current = { x: event.clientX, y: event.clientY, ...angle };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = dragOrigin.current;
    if (!origin) {
      return;
    }
    setAngle({
      ry: clamp(origin.ry + (event.clientX - origin.x) * 0.35, -55, 55),
      rx: clamp(origin.rx - (event.clientY - origin.y) * 0.25, -10, 40),
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) {
      return;
    }
    dragOrigin.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (lines.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">お題コードがまだありません。</p>;
  }

  const towerClassName = [
    styles.tower,
    isDragging ? styles.towerDragging : "",
    !isDragging && !collapsed ? styles.towerIdle : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.scene} style={{ paddingTop: 24, paddingBottom: collapsed ? 176 : 24 }}>
      <div
        className={towerClassName}
        style={{ "--rx": `${angle.rx}deg`, "--ry": `${angle.ry}deg` } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => setAngle({ rx: DEFAULT_RX, ry: DEFAULT_RY })}
      >
        {lines.map((line, index) => {
          const lineNo = index + 1;
          const isBlank = line.trim().length === 0;
          const isSelected = selectedLineNo === lineNo;
          const canSelect = interactive && !collapsed && !isBlank;

          const className = [
            styles.piece,
            isBlank ? styles.pieceBlank : "",
            canSelect ? styles.pieceSelectable : "",
            isSelected ? styles.pieceSelected : "",
            collapsed ? styles.pieceFalling : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={lineNo}
              type="button"
              className={className}
              disabled={!canSelect}
              aria-pressed={isSelected}
              aria-label={`${lineNo} 行目: ${isBlank ? "空行" : line.trim()}`}
              onClick={() => onSelectLine(lineNo)}
              style={fallStyle(index, lines.length)}
            >
              {/* 回したときに中が抜けないよう、見えない面も置く */}
              <span className={`${styles.face} ${styles.top}`} />
              <span className={`${styles.face} ${styles.bottom}`} />
              <span className={`${styles.face} ${styles.side}`} />
              <span className={`${styles.face} ${styles.side} ${styles.sideLeft}`} />
              <span className={`${styles.face} ${styles.back}`} />

              <span className={`${styles.face} ${styles.front}`}>
                <span className={styles.lineNo}>{String(lineNo).padStart(2, "0")}</span>
                <span className={styles.lineText}>{line.trim()}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!collapsed ? (
        <p className={styles.hint}>
          {interactive
            ? "削除する行をクリック · ドラッグで回転 · ダブルクリックで戻す"
            : "ドラッグで回転 · ダブルクリックで戻す"}
        </p>
      ) : null}
    </div>
  );
}

/** 崩れ方は段ごとに散らす（見た目だけなので index から決める）。上の段ほど遠くまで落ちる */
function fallStyle(index: number, total: number): CSSProperties {
  return {
    "--face": FACE_COLORS[index % FACE_COLORS.length],
    "--fall-x": `${((index % 3) - 1) * 46}px`,
    "--fall-y": `${40 + (total - index) * 16}px`,
    "--fall-z": `${((index % 4) - 1) * 44}px`,
    "--fall-rx": `${26 + (index % 3) * 22}deg`,
    "--fall-rz": `${((index % 5) - 2) * 14}deg`,
    "--fall-delay": `${index * 45}ms`,
  } as CSSProperties;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
