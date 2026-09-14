import type { GeneratedCode } from "@/lib/game/types";
export interface AiCodeGenerator { generateCode(): Promise<GeneratedCode>; }