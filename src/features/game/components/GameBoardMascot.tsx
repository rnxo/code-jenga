"use client";

import { useEffect, useState } from "react";
import { useTurnTimer } from "../hooks/useTurnTimer";
import { pickMascotLine, type MascotLine, type MascotSituation } from "../mascot-lines";
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
}

export function GameBoardMascot({
  isMyTurn,
  selectedLineNo,
  blockedReason,
  turnDeadlineAt,
  latestTurnResult,
  latestTurnByMe,
  turnNo,
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
  });
  const mascotKey = `${situation}:${turnNo}:${idleTick}`;
  const [mascot, setMascot] = useState<{ key: string; line: MascotLine } | null>(null);
  if (mascot === null || mascot.key !== mascotKey) {
    setMascot({ key: mascotKey, line: pickMascotLine(situation, mascot?.line.message ?? null) });
  }

  const mascotLine = mascot?.line ?? pickMascotLine(situation);
  return <Mascot message={mascotLine.message} mood={mascotLine.mood} />;
}

interface MascotContext {
  isMyTurn: boolean;
  isSelected: boolean;
  isBlocked: boolean;
  isHurrying: boolean;
  latestTurnResult: "safe" | "out" | "timeout" | null;
  latestTurnByMe: boolean;
  idleTick: number;
}

function resolveMascotSituation(ctx: MascotContext): MascotSituation {
  if (ctx.isMyTurn && ctx.isHurrying) return "hurry";
  if (ctx.isMyTurn && ctx.isBlocked) return "blocked";
  if (ctx.isMyTurn && ctx.isSelected) return "selected";
  if (ctx.idleTick > 0 && ctx.idleTick % 2 === 1) return "idle";
  if (ctx.latestTurnResult === "safe") {
    return ctx.latestTurnByMe ? "safe_mine" : "safe_opponent";
  }
  return ctx.isMyTurn ? "my_turn" : "waiting";
}