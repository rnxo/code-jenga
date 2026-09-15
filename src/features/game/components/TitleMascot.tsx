"use client";

import { useSyncExternalStore } from "react";
import { pickMascotLine, type MascotLine } from "../mascot-lines";
import { Mascot } from "./Mascot";

// タイトル画面の右下に常駐するマスコット（#42）。
// セリフはランダムなので、SSR では絵だけ出し、クライアントで初めて選ぶ（hydration のズレを避ける）。

const subscribe = () => () => {};
let chosenLine: MascotLine | null = null;
const getSnapshot = () => (chosenLine ??= pickMascotLine("title"));
const getServerSnapshot = () => null;

export function TitleMascot() {
  const line = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <Mascot message={line?.message ?? null} mood={line?.mood ?? "idle"} />;
}
