import type { ComposeInput, ComposedProgram } from "./compose";

/** Brainfuck はテストコードを持たず、sourceCode 自体をそのまま実行する。 */
export function composeBrainfuckProgram(input: ComposeInput): ComposedProgram {
  return {
    program: input.sourceCode,
    sourceStartLine: 1,
    removed: [],
  };
}