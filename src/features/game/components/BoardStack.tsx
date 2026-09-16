"use client";

import { useState, type ReactNode } from "react";
import styles from "./BoardStack.module.css";

// 盤面の 3D タワーと 2D のコードを並べる入れもの。担当: ようた（見た目）
//
// 同じソースコードの見せ方が2つある（積み木と Monaco）。どちらも要るが、
// 縦に積むと盤面が長くなりすぎて、下の削除ボタンや判定まで届かない。
//
// なので横幅で出し分ける。
//   広い画面 … 横に2つ並べる。両方いっぺんに見える
//   狭い画面 … どちらか片方だけ。ボタン1つで入れ替える
//
// どちらに転ぶかは CSS のメディアクエリが決める。要素を実測して state に
// 入れる形は、このリポジトリの react-hooks/set-state-in-effect に引っかかる。

/** 狭い画面でどちらを出しているか。広い画面では両方出るので使われない */
export type BoardView = "tower" | "code";

export interface BoardStackProps {
  /** 3D のタワー */
  tower: ReactNode;
  /** 2D のコード（Monaco） */
  code: ReactNode;
}

const LABEL: Record<BoardView, string> = {
  // ボタンには「次に出るほう」を書く。いま出ているものを書くと、押した結果と読めてしまう
  tower: "コードで見る",
  code: "タワーで見る",
};

export function BoardStack({ tower, code }: BoardStackProps) {
  const [view, setView] = useState<BoardView>("tower");

  return (
    <div className={styles.stack} data-view={view}>
      {/* 狭い画面でだけ出る。広い画面では両方見えているので、切り替える意味がない */}
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setView(view === "tower" ? "code" : "tower")}
      >
        {LABEL[view]}
      </button>

      <div className={styles.pane} data-pane="tower">
        {tower}
      </div>
      <div className={styles.pane} data-pane="code">
        {code}
      </div>
    </div>
  );
}
