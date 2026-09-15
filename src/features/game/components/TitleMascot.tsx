"use client";

import { useEffect, useSyncExternalStore } from "react";
import { pickMascotLine, type MascotLine } from "../mascot-lines";
import { Mascot } from "./Mascot";

// タイトル画面の右下に常駐するマスコット（#42）。
// セリフはランダムなので、SSR では絵だけ出し、クライアントで初めて選ぶ（hydration のズレを避ける）。
// 選んだセリフはアンマウント時に捨て、タイトルに戻ってくるたびに選び直す。

const subscribe = () => () => {};
let chosenLine: MascotLine | null = null;
const getSnapshot = () => (chosenLine ??= pickMascotLine("title"));
const getServerSnapshot = () => null;

export function TitleMascot() {
  const line = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    return () => {
      chosenLine = null;
    };
  }, []);
  return <Mascot message={line?.message ?? null} mood={line?.mood ?? "idle"} />;
}
