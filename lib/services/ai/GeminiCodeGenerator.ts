import type { GeneratedCode } from "@/lib/game/types";
import type { AiCodeGenerator } from "@/lib/services/ai/AiCodeGenerator";
export class GeminiCodeGenerator implements AiCodeGenerator { async generateCode(): Promise<GeneratedCode> { throw new Error("Gemini integration is not configured yet"); } }