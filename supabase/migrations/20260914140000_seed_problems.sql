-- Gemini 障害時のフォールバック用シードお題（DB_DESIGN.md 4.2 の補足）。
-- is_verified は false で投入し、Piston での事前検証（POST /api/problems/verify）を通してから true にする。
-- 手作業で true にすると「検証していないお題でゲームが始まる」穴が残るため、ここでは立てない。

insert into public.problems (source_code, test_code, language, initial_line_count, generated_by, difficulty, is_verified)
values
(
$src$export function sum(numbers: number[]): number {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  return sum(numbers) / numbers.length;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { average, sum } from "./math";

describe("sum", () => {
  it("合計を返す", () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
  it("空配列は 0", () => {
    expect(sum([])).toBe(0);
  });
});

describe("average", () => {
  it("平均を返す", () => {
    expect(average([2, 4, 6])).toBe(4);
  });
  it("空配列は 0", () => {
    expect(average([])).toBe(0);
  });
});$test$,
  'typescript', 14, 'seed', 'easy', false
),
(
$src$export function fizzBuzz(n: number): string {
  if (n % 15 === 0) {
    return "FizzBuzz";
  }
  if (n % 3 === 0) {
    return "Fizz";
  }
  if (n % 5 === 0) {
    return "Buzz";
  }
  return String(n);
}

export function fizzBuzzRange(from: number, to: number): string[] {
  const result: string[] = [];
  for (let i = from; i <= to; i += 1) {
    result.push(fizzBuzz(i));
  }
  return result;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { fizzBuzz, fizzBuzzRange } from "./fizzbuzz";

describe("fizzBuzz", () => {
  it("3 の倍数は Fizz", () => {
    expect(fizzBuzz(9)).toBe("Fizz");
  });
  it("5 の倍数は Buzz", () => {
    expect(fizzBuzz(10)).toBe("Buzz");
  });
  it("15 の倍数は FizzBuzz", () => {
    expect(fizzBuzz(30)).toBe("FizzBuzz");
  });
  it("それ以外は数字", () => {
    expect(fizzBuzz(7)).toBe("7");
  });
});

describe("fizzBuzzRange", () => {
  it("範囲を順に変換する", () => {
    expect(fizzBuzzRange(1, 5)).toEqual(["1", "2", "Fizz", "4", "Buzz"]);
  });
});$test$,
  'typescript', 20, 'seed', 'normal', false
),
(
$src$export function reverseString(input: string): string {
  const chars = input.split("");
  chars.reverse();
  return chars.join("");
}

export function isPalindrome(input: string): boolean {
  const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === reverseString(normalized);
}

export function countVowels(input: string): number {
  let count = 0;
  for (const ch of input.toLowerCase()) {
    if ("aeiou".includes(ch)) {
      count += 1;
    }
  }
  return count;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { countVowels, isPalindrome, reverseString } from "./strings";

describe("reverseString", () => {
  it("文字列を反転する", () => {
    expect(reverseString("abc")).toBe("cba");
  });
});

describe("isPalindrome", () => {
  it("回文を判定する", () => {
    expect(isPalindrome("A man, a plan, a canal: Panama")).toBe(true);
    expect(isPalindrome("hello")).toBe(false);
  });
});

describe("countVowels", () => {
  it("母音を数える", () => {
    expect(countVowels("Hello World")).toBe(3);
  });
});$test$,
  'typescript', 20, 'seed', 'normal', false
);
