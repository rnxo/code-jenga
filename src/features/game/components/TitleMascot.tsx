"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { pickMascotLine, type MascotLine } from "../mascot-lines";
import { Mascot } from "./Mascot";

// タイトル画面のマスコット（#42）。「始める」に被さって邪魔をする（置き場所は page.tsx が決める）。
// セリフはランダムなので、SSR では絵だけ出し、クライアントで初めて選ぶ（hydration のズレを避ける）。
// 選んだセリフはアンマウント時に捨て、タイトルに戻ってくるたびに選び直す。
// 吹き出しをクリックすると次のセリフに送る。

const subscribe = () => () => {};
let chosenLine: MascotLine | null = null;
const getSnapshot = () => (chosenLine ??= pickMascotLine("title"));
const getServerSnapshot = () => null;

export function TitleMascot() {
  const initialLine = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /** クリックで送ったセリフ。null なら最初に選んだものを出す */
  const [nextLine, setNextLine] = useState<MascotLine | null>(null);
  const line = nextLine ?? initialLine;

  useEffect(() => {
    return () => {
      chosenLine = null;
    };
  }, []);

  return (
    <Mascot
      message={line?.message ?? null}
      mood={line?.mood ?? "idle"}
      anchored={false}
      onBubbleClick={() => setNextLine(pickMascotLine("title", line?.message ?? null))}
    />
  );
}
