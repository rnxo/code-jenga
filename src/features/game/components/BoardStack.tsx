"use client";

import { useState, type ReactNode } from "react";
import styles from "./BoardStack.module.css";

// 盤面の 3D タワーと 2D のコードを縦に並べる入れもの。担当: ようた（見た目）
//
// 2つ並べると縦に長くなり、画面が低い端末では下の操作まで届かない。
// 既定（auto）では画面の高さで 2D のコードを畳み、必要なら手で切り替えられるようにする。
// 高さの判定は CSS のメディアクエリでやるので、要素の実測は持たない。

export type BoardView = "auto" | "both" | "tower" | "code";

export interface BoardStackProps {
  /** 3D のタワー */
  tower: ReactNode;
  /** 2D のコード（Monaco） */
  code: ReactNode;
}

const OPTIONS: readonly { value: Exclude<BoardView, "auto">; label: string }[] = [
  { value: "both", label: "両方" },
  { value: "tower", label: "3D" },
  { value: "code", label: "コード" },
] as const;

export function BoardStack({ tower, code }: BoardStackProps) {
  const [view, setView] = useState<BoardView>("auto");

  const towerClassName = [styles.pane, view === "code" ? styles.hidden : ""]
    .filter(Boolean)
    .join(" ");

  const codeClassName = [
    styles.pane,
    view === "tower" ? styles.hidden : "",
    // auto のときだけ、画面が低ければ CSS 側で畳む
    view === "auto" ? styles.autoHidden : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.stack}>
      <div className={styles.switch}>
        <span className={styles.switchLabel}>view</span>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            className={[
              styles.switchButton,
              view === option.value ? styles.switchButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setView(view === option.value ? "auto" : option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={towerClassName}>{tower}</div>
      <div className={codeClassName}>{code}</div>
    </div>
  );
}
