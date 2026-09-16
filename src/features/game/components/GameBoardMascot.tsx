"use client";

import { useEffect, useState } from "react";
import { useTurnTimer } from "../hooks/useTurnTimer";
import { pickMascotLine, type MascotLine, type MascotSituation } from "../mascot-lines";
import type { SabotageIncident } from "../sabotage";
import { Mascot } from "./Mascot";

const MASCOT_HURRY_SECONDS = 10;
const MASCOT_IDLE_MS = 25_000;

interface GameBoardMascotProps {
  isMyTurn: boolean;
  selectedLineNo: number | null;
  blockedReason: string | null;
  turnDeadlineAt: string | null;
  latestTurnResult: "safe" | "out" | "timeout" | null;
  latestTurnByMe: boolean;
  turnNo: number;
  /** 進行中の妨害。null なら無し */
  sabotage?: SabotageIncident | null;
}

export function GameBoardMascot({
  isMyTurn,
  selectedLineNo,
  blockedReason,
  turnDeadlineAt,
  latestTurnResult,
  latestTurnByMe,
  turnNo,
  sabotage = null,
}: GameBoardMascotProps) {
  const remainingSeconds = useTurnTimer(turnDeadlineAt);
  const [idleTick, setIdleTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdleTick((tick) => tick + 1), MASCOT_IDLE_MS);
    return () => clearInterval(id);
  }, []);

  const situation = resolveMascotSituation({
    isMyTurn,
    isSelected: selectedLineNo !== null,
    isBlocked: blockedReason !== null,
    isHurrying: remainingSeconds <= MASCOT_HURRY_SECONDS && turnDeadlineAt !== null,
    latestTurnResult,
    latestTurnByMe,
    idleTick,
    sabotage,
  });
  // 妨害は同じ状況でも回ごとにセリフを引き直したいので id を混ぜる
  const mascotKey = `${situation}:${turnNo}:${idleTick}:${sabotage?.id ?? 0}`;
  const [mascot, setMascot] = useState<{ key: string; line: MascotLine } | null>(null);
  if (mascot === null || mascot.key !== mascotKey) {
    setMascot({ key: mascotKey, line: pickMascotLine(situation, mascot?.line.message ?? null) });
  }

  const mascotLine = mascot?.line ?? pickMascotLine(situation);
  return <Mascot message={mascotLine.message} mood={mascotLine.mood} />;
}

export interface MascotContext {
  isMyTurn: boolean;
  isSelected: boolean;
  isBlocked: boolean;
  isHurrying: boolean;
  latestTurnResult: "safe" | "out" | "timeout" | null;
  latestTurnByMe: boolean;
  idleTick: number;
  sabotage: SabotageIncident | null;
}

export function resolveMascotSituation(ctx: MascotContext): MascotSituation {
  // 残り時間がわずかなら、邪魔されていても急かすほうを優先する
  if (ctx.isMyTurn && ctx.isHurrying) return "hurry";
  if (ctx.sabotage !== null) return ctx.sabotage.byMe ? "sabotaging" : "sabotaged";
  if (ctx.isMyTurn && ctx.isBlocked) return "blocked";
  if (ctx.isMyTurn && ctx.isSelected) return "selected";
  if (ctx.idleTick > 0 && ctx.idleTick % 2 === 1) return "idle";
  if (ctx.latestTurnResult === "safe") {
    return ctx.latestTurnByMe ? "safe_mine" : "safe_opponent";
  }
  return ctx.isMyTurn ? "my_turn" : "waiting";
}