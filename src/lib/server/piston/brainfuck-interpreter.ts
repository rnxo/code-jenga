// Brainfuck をサーバー内で実行する最小インタプリタ（純粋モジュール、"server-only" は付けない）。
//
// 用途: Gemini が生成した Brainfuck お題の「期待標準出力」を、Gemini の申告ではなく実際の実行結果で確定させる。
// Gemini は ASCII コードの加減算を間違えやすく（"OK" のつもりで "NK" を出すなど）、申告値をそのまま
// testCode にすると Piston の事前検証でほぼ必ず落ちて再生成を繰り返すため。
// 最終的な正誤判定は従来通り Piston（testStrategy: "stdout"）が行う。ここでは判定を肩代わりしない。
//
// 仕様: セルは 8bit ラップアラウンド、テープは固定長で範囲外アクセスはエラー。
// 入力命令（,）は EOF 扱いで 0 を書く。無限ループ対策に実行ステップ数の上限を設ける。

export const BRAINFUCK_TAPE_SIZE = 30_000;
export const BRAINFUCK_MAX_STEPS = 1_000_000;

export type BrainfuckRunResult =
  | { ok: true; output: string; steps: number }
  | { ok: false; reason: string };

/** Brainfuck の8命令以外の文字を取り除く（他の文字はコメント扱い）。 */
function stripComments(source: string): string {
  return source.replace(/[^+\-<>[\].,]/g, "");
}

/** 対応する括弧の位置表を作る。対応が取れなければ null。 */
function buildJumpTable(code: string): Map<number, number> | null {
  const table = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === "[") {
      stack.push(i);
    } else if (code[i] === "]") {
      const open = stack.pop();
      if (open === undefined) {
        return null;
      }
      table.set(open, i);
      table.set(i, open);
    }
  }
  return stack.length === 0 ? table : null;
}

export function runBrainfuck(source: string): BrainfuckRunResult {
  const code = stripComments(source);
  const jumps = buildJumpTable(code);
  if (jumps === null) {
    return { ok: false, reason: "[ と ] の対応が取れていません。" };
  }

  const tape = new Uint8Array(BRAINFUCK_TAPE_SIZE);
  let pointer = 0;
  let pc = 0;
  let steps = 0;
  const output: number[] = [];

  while (pc < code.length) {
    steps += 1;
    if (steps > BRAINFUCK_MAX_STEPS) {
      return {
        ok: false,
        reason: `実行ステップ数が上限（${BRAINFUCK_MAX_STEPS}）を超えました。無限ループの可能性があります。`,
      };
    }
    const op = code[pc];
    switch (op) {
      case "+":
        tape[pointer] = (tape[pointer] + 1) & 0xff;
        break;
      case "-":
        tape[pointer] = (tape[pointer] - 1) & 0xff;
        break;
      case ">":
        pointer += 1;
        if (pointer >= BRAINFUCK_TAPE_SIZE) {
          return { ok: false, reason: "ポインタがテープの右端を超えました。" };
        }
        break;
      case "<":
        pointer -= 1;
        if (pointer < 0) {
          return { ok: false, reason: "ポインタがテープの左端を超えました。" };
        }
        break;
      case ".":
        output.push(tape[pointer]);
        break;
      case ",":
        tape[pointer] = 0;
        break;
      case "[":
        if (tape[pointer] === 0) {
          pc = jumps.get(pc) ?? pc;
        }
        break;
      case "]":
        if (tape[pointer] !== 0) {
          pc = jumps.get(pc) ?? pc;
        }
        break;
      default:
        break;
    }
    pc += 1;
  }

  return { ok: true, output: String.fromCharCode(...output), steps };
}
