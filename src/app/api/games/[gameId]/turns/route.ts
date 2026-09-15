import type { CreateTurnRequest, CreateTurnResponse } from "@/types/api";
import { toErrorResponse, toSuccessResponse } from "@/lib/api/errors";
import { ApplicationError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/server/auth";
import { applyTurn } from "@/lib/server/game/apply-turn";

// POST /api/games/[gameId]/turns — 1手確定（DB_DESIGN.md 5章-5）
// 実装は @/lib/server/game/apply-turn の applyTurn に委譲する想定。
// 担当: BE-A

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const { gameId } = await params;
    const body: unknown = await request.json();
    const req = body as CreateTurnRequest;
    const data = await handleCreateTurn(gameId, req);
    return toSuccessResponse(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleCreateTurn(
  gameId: string,
  req: CreateTurnRequest,
): Promise<CreateTurnResponse> {
  const playerId = await requireUserId();
  if (!Number.isInteger(req.lineNo) || req.lineNo < 1) {
    throw new ApplicationError("INVALID_LINE", "削除行番号は1以上の整数で指定してください。");
  }
  return applyTurn({ gameId, playerId, lineNo: req.lineNo });
}
