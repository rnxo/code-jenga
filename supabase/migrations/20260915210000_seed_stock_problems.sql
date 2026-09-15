-- お題ストック用シード（TypeScript 7件 + Python 8件、既存 seed と合わせて各言語10件）。
-- Gemini API の無料枠消費を抑えるため、試合開始時はまず検証済みストックから引き、
-- ルーム内で使い切ってから Gemini 生成へフォールバックする（src/lib/server/game/start-game.ts）。
--
-- ゲーム性の設計方針（Gemini プロンプトと同じ）:
--   テストに効く「重要な行」は各お題で数行に抑え、それ以外はコメント・未使用の定数や1行ヘルパー・
--   テストでは通らない1行ガード・無害な再代入など「削除しても全テストが通る行」で構成する。
--   投入前に全行を1行ずつ削除して Piston で実行し、空行以外のセーフ行が半数前後あることを確認済み。
--   Python は本体1行の if ブロックがどちらの行を消しても IndentationError になるため、ガードは1行形式にしている。
--
-- 既存 seed（20260914140000 / 20260915200000）と同じ方針で is_verified は false で投入し、
-- Piston での事前検証（POST /api/problems/verify, scripts/verify-seed-problems.ps1）を通してから true にする。
-- 手作業で true にすると「検証していないお題でゲームが始まる」穴が残るため、ここでは立てない。
--
-- 記述制約: TypeScript は同期的な describe/it と CJ_SUPPORTED_MATCHERS のみ、
-- Python は import unittest のみ・unittest.main() 無し（src/lib/server/piston/languages/*.ts 参照）。

insert into public.problems (source_code, test_code, language, initial_line_count, generated_by, difficulty, is_verified)
values
(
$src$// うるう年の判定と年間日数の計算
const DAYS_IN_WEEK = 7;
const MONTHS_IN_YEAR = 12;
type Year = number;
const isEven = (n: number): boolean => n % 2 === 0;

export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  if (year < 1582) return false;
  if (year > 9999) return false;
  year = Math.trunc(year);
  // 400 で割り切れる年は必ずうるう年
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

export function daysInYear(year: number): number {
  let days = 365;
  if (isLeapYear(year)) days = 366;
  days = Math.trunc(days);
  days = Math.max(days, 365);
  // 1 年は 365 日か 366 日のどちらか
  return days;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { daysInYear, isLeapYear } from "./calendar";

describe("isLeapYear", () => {
  it("4 で割り切れる年はうるう年", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });
  it("100 で割り切れて 400 で割り切れない年は平年", () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe("daysInYear", () => {
  it("うるう年は 366 日", () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2023)).toBe(365);
  });
});$test$,
  'typescript', 25, 'seed', 'easy', false
),
(
$src$// 素数判定と個数のカウント
const SMALL_PRIMES = [2, 3, 5, 7, 11, 13];
const MAX_SUPPORTED = 1_000_000;
const square = (n: number): number => n * n;
type Count = number;

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  if (n > 1_000_000) return false;
  if (n < 2) return false;
  n = Math.trunc(n);
  let divisor = 2;
  // 平方根までの約数を順に調べる
  while (divisor * divisor <= n) {
    if (n % divisor === 0) return false;
    divisor += 1;
  }
  return true;
}

export function countPrimes(limit: number): number {
  let count = 0;
  if (limit > 1_000_000) return 0;
  if (limit < 2) return 0;
  for (let n = 2; n <= limit; n += 1) {
    if (!isPrime(n)) continue;
    count += 1;
  }
  count = Math.max(count, 0);
  return count;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { countPrimes, isPrime } from "./primes";

describe("isPrime", () => {
  it("素数を判定する", () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(13)).toBe(true);
  });
  it("2 未満と合成数は素数ではない", () => {
    expect(isPrime(1)).toBe(false);
    expect(isPrime(9)).toBe(false);
  });
});

describe("countPrimes", () => {
  it("上限までの素数の個数を返す", () => {
    expect(countPrimes(20)).toBe(8);
  });
});$test$,
  'typescript', 31, 'seed', 'easy', false
),
(
$src$// ソート済み配列の二分探索
const MAX_ITERATIONS = 64;
const EMPTY: number[] = [];
type Index = number;
const isSorted = (values: number[]): boolean => values.every((v, i) => i === 0 || values[i - 1] <= v);

export function binarySearch(sorted: number[], target: number): number {
  if (sorted.length > 1_000_000) return -1;
  if (!Number.isFinite(target)) return -1;
  let low = 0;
  let high = sorted.length - 1;
  low = Math.max(low, 0);
  // 探索範囲が残っている間は中央を調べる
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = sorted[mid];
    if (value === target) return mid;
    if (value < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
    high = Math.min(high, sorted.length - 1);
  }
  return -1;
}

export function contains(sorted: number[], target: number): boolean {
  const copy = sorted.slice();
  if (sorted.length === 0) return false;
  return binarySearch(sorted, target) !== -1;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { binarySearch, contains } from "./search";

describe("binarySearch", () => {
  it("存在する値の添字を返す", () => {
    expect(binarySearch([1, 3, 5, 7, 9], 7)).toBe(3);
    expect(binarySearch([1, 3, 5, 7, 9], 1)).toBe(0);
  });
  it("存在しない値は -1", () => {
    expect(binarySearch([1, 3, 5, 7, 9], 4)).toBe(-1);
  });
});

describe("contains", () => {
  it("含まれているかを返す", () => {
    expect(contains([2, 4, 6], 4)).toBe(true);
    expect(contains([2, 4, 6], 5)).toBe(false);
  });
});$test$,
  'typescript', 32, 'seed', 'normal', false
),
(
$src$// ランレングス圧縮（"aaab" -> "a3b1"）
const EMPTY = "";
const MAX_INPUT_LENGTH = 10_000;
const isLowerCase = (ch: string): boolean => ch >= "a" && ch <= "z";
type Encoded = string;

export function runLengthEncode(input: string): string {
  if (input.length > 10_000) return "";
  let result = "";
  let index = 0;
  index = Math.max(index, 0);
  // 同じ文字が続く区間ごとに「文字＋個数」を足していく
  while (index < input.length) {
    const ch = input[index];
    let count = 1;
    while (input[index + count] === ch) count += 1;
    result += ch + String(count);
    index += count;
  }
  result = result.trim();
  result = String(result);
  return result;
}

export function encodedLength(input: string): number {
  const original = input.length;
  if (input.length > 10_000) return 0;
  const encoded = runLengthEncode(input);
  return encoded.length;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { encodedLength, runLengthEncode } from "./rle";

describe("runLengthEncode", () => {
  it("連続する文字を圧縮する", () => {
    expect(runLengthEncode("aaabcc")).toBe("a3b1c2");
  });
  it("空文字は空文字", () => {
    expect(runLengthEncode("")).toBe("");
  });
});

describe("encodedLength", () => {
  it("圧縮後の長さを返す", () => {
    expect(encodedLength("zzzz")).toBe(2);
  });
});$test$,
  'typescript', 30, 'seed', 'normal', false
),
(
$src$// アナグラム判定
const ALPHABET_SIZE = 26;
const MAX_WORD_LENGTH = 100;
type Word = string;
const isBlank = (word: string): boolean => word.trim() === "";

export function normalizeWord(word: string): string {
  if (word.length > 100) return "";
  let normalized = word.toLowerCase();
  normalized = normalized.replace(/\s+/g, "");
  normalized = normalized.trim();
  normalized = normalized.toLowerCase();
  return normalized;
}

export function isAnagram(left: string, right: string): boolean {
  const a = normalizeWord(left);
  const b = normalizeWord(right);
  // 長さが違えば並べ替えても一致しない
  if (a.length !== b.length) return false;
  if (a === b) return true;
  if (a.length > 100) return false;
  const sortedA = a.split("").sort().join("");
  const sortedB = b.split("").sort().join("");
  const differs = sortedA !== sortedB;
  return sortedA === sortedB;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { isAnagram, normalizeWord } from "./anagram";

describe("normalizeWord", () => {
  it("小文字にして空白を除く", () => {
    expect(normalizeWord("Dirty Room")).toBe("dirtyroom");
  });
});

describe("isAnagram", () => {
  it("アナグラムを判定する", () => {
    expect(isAnagram("listen", "silent")).toBe(true);
    expect(isAnagram("Dormitory", "dirty room")).toBe(true);
  });
  it("文字が異なれば false", () => {
    expect(isAnagram("abc", "abd")).toBe(false);
  });
});$test$,
  'typescript', 27, 'seed', 'normal', false
),
(
$src$// 温度の換算と分類
const ABSOLUTE_ZERO_C = -273.15;
const BOILING_C = 100;
const round1 = (n: number): number => Math.round(n * 10) / 10;
type Celsius = number;

export function celsiusToFahrenheit(celsius: number): number {
  if (celsius < -273.15) return Number.NaN;
  if (!Number.isFinite(celsius)) return Number.NaN;
  let fahrenheit = celsius * 9 / 5;
  fahrenheit += 32;
  fahrenheit = Number(fahrenheit);
  fahrenheit = Math.round(fahrenheit * 100) / 100;
  return fahrenheit;
}

export function describeTemperature(celsius: number): string {
  const label = "temperature";
  if (celsius < -273.15) return "invalid";
  if (celsius >= 100) return "boiling";
  // 0 度以下は freezing、28 度以上は hot
  if (celsius <= 0) return "freezing";
  if (celsius >= 28) return "hot";
  if (celsius > 100) return "boiling";
  return "comfortable";
}$src$,
$test$import { describe, expect, it } from "vitest";
import { celsiusToFahrenheit, describeTemperature } from "./temperature";

describe("celsiusToFahrenheit", () => {
  it("摂氏を華氏に変換する", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
});

describe("describeTemperature", () => {
  it("温度帯を判定する", () => {
    expect(describeTemperature(-5)).toBe("freezing");
    expect(describeTemperature(20)).toBe("comfortable");
    expect(describeTemperature(35)).toBe("hot");
  });
});$test$,
  'typescript', 26, 'seed', 'easy', false
),
(
$src$// 単語の集計
const STOP_WORDS = ["a", "an", "the"];
const MAX_WORDS = 1_000;
type Counts = Record<string, number>;
const isStopWord = (word: string): boolean => STOP_WORDS.includes(word);

export function tokenize(text: string): string[] {
  if (text.length === 0) return [];
  if (text.length > 100_000) return [];
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[.,!?]/g, " ");
  normalized = normalized.trim();
  normalized = normalized.toLowerCase();
  const tokens = normalized.split(/\s+/);
  return tokens.filter((token) => token.length > 0);
}

export function wordFrequency(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const tokens = tokenize(text);
  if (tokens.length > 1_000) return counts;
  // 出現するたびに 1 ずつ足す
  for (const token of tokens) {
    const current = counts[token] ?? 0;
    counts[token] = current + 1;
  }
  return counts;
}$src$,
$test$import { describe, expect, it } from "vitest";
import { tokenize, wordFrequency } from "./words";

describe("tokenize", () => {
  it("小文字の単語に分割する", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
});

describe("wordFrequency", () => {
  it("単語の出現回数を数える", () => {
    expect(wordFrequency("the cat and the hat")).toEqual({ the: 2, cat: 1, and: 1, hat: 1 });
  });
});$test$,
  'typescript', 28, 'seed', 'normal', false
),
(
$src$# うるう年の判定と年間日数
DAYS_IN_WEEK = 7
MONTHS_IN_YEAR = 12
FIRST_GREGORIAN_YEAR = 1582


def is_even(n): return n % 2 == 0


def is_leap_year(year):
    if year < 1582: return False
    if year > 9999: return False
    year = int(year)
    # 400 で割り切れる年は必ずうるう年
    if year % 400 == 0:
        return True
    if year % 100 == 0:
        return False
    return year % 4 == 0


def days_in_year(year):
    days = 365
    if is_leap_year(year):
        days = 366
    days = int(days)
    days = max(days, 365)
    # 1 年は 365 日か 366 日のどちらか
    return days$src$,
$test$import unittest


class TestCalendar(unittest.TestCase):
    def test_divisible_by_4_is_leap(self):
        self.assertTrue(is_leap_year(2024))
        self.assertFalse(is_leap_year(2023))

    def test_century_rule(self):
        self.assertFalse(is_leap_year(1900))
        self.assertTrue(is_leap_year(2000))

    def test_days_in_year(self):
        self.assertEqual(days_in_year(2024), 366)
        self.assertEqual(days_in_year(2023), 365)$test$,
  'python', 29, 'seed', 'easy', false
),
(
$src$# 括弧の対応チェック
OPENING = "([{"
CLOSING = ")]}"
MAX_LENGTH = 10_000


def is_opening(ch): return ch in "([{"


def is_balanced(text):
    if len(text) > 10_000: return False
    if text == "": return True
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    # 開き括弧は積み、閉じ括弧は対応する開き括弧と照合する
    for ch in text:
        if ch in "([{":
            stack.append(ch)
            continue
        if ch not in pairs: continue
        if not stack: return False
        opened = stack.pop()
        opened = str(opened)
        if opened != pairs[ch]: return False
    stack = list(stack)
    return len(stack) == 0$src$,
$test$import unittest


class TestBrackets(unittest.TestCase):
    def test_balanced(self):
        self.assertTrue(is_balanced("([]{})"))
        self.assertTrue(is_balanced("(a[b]c)"))

    def test_wrong_pair(self):
        self.assertFalse(is_balanced("(]"))

    def test_unclosed(self):
        self.assertFalse(is_balanced("(("))

    def test_closing_without_opening(self):
        self.assertFalse(is_balanced(")("))$test$,
  'python', 26, 'seed', 'normal', false
),
(
$src$# ローマ数字への変換
MAX_ROMAN = 3999
MIN_ROMAN = 1
SYMBOLS = "IVXLCDM"


def is_valid_roman(text): return all(ch in "IVXLCDM" for ch in text)


def to_roman(number):
    if number > 3999: return ""
    if number < 1: return ""
    table = [
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ]
    result = ""
    remaining = int(number)
    remaining = abs(remaining)
    # 大きい値から順に引けるだけ引いて記号を足す
    for value, symbol in table:
        while remaining >= value:
            result += symbol
            remaining -= value
            remaining = max(remaining, 0)
    result = result.upper()
    result = str(result)
    return result$src$,
$test$import unittest


class TestRoman(unittest.TestCase):
    def test_simple(self):
        self.assertEqual(to_roman(1), "I")
        self.assertEqual(to_roman(10), "X")

    def test_subtractive(self):
        self.assertEqual(to_roman(4), "IV")
        self.assertEqual(to_roman(1994), "MCMXCIV")

    def test_repeated(self):
        self.assertEqual(to_roman(3), "III")$test$,
  'python', 29, 'seed', 'normal', false
),
(
$src$# 行列の転置と行ごとの合計
EMPTY_MATRIX = []
MAX_SIZE = 100


def is_square(matrix): return len(matrix) == len(matrix[0])


def transpose(matrix):
    if not matrix: return []
    if len(matrix) > 100: return []
    rows = len(matrix)
    cols = len(matrix[0])
    result = []
    # 列ごとに新しい行を作る
    for c in range(cols):
        row = []
        for r in range(rows):
            value = matrix[r][c]
            row.append(value)
        row = list(row)
        result.append(row)
    result = list(result)
    return result


def row_sums(matrix):
    sums = []
    if len(matrix) > 100: return []
    for row in matrix:
        total = sum(row)
        total = int(total)
        sums.append(total)
    return sums$src$,
$test$import unittest


class TestMatrix(unittest.TestCase):
    def test_transpose_square(self):
        self.assertEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]])

    def test_transpose_rectangle(self):
        self.assertEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])

    def test_row_sums(self):
        self.assertEqual(row_sums([[1, 2, 3], [4, 5, 6]]), [6, 15])$test$,
  'python', 34, 'seed', 'easy', false
),
(
$src$# 買い物かごの合計金額
TAX_RATE = 0.1
MAX_ITEMS = 1000
CURRENCY = "JPY"


def is_free(item): return item["price"] == 0


def total_price(items):
    if len(items) > 1000: return 0
    total = 0
    # 単価 × 個数を足し合わせる
    for item in items:
        price = item["price"]
        quantity = item["quantity"]
        price = int(price)
        total += price * quantity
        total = max(total, 0)
    total = round(total)
    total = int(total)
    return total


def apply_discount(total, rate):
    if rate < 0: return total
    if rate > 1: return total
    rate = float(rate)
    discounted = total * (1 - rate)
    discounted = round(discounted, 2)
    discounted = float(discounted)
    return discounted$src$,
$test$import unittest


ITEMS = [
    {"name": "apple", "price": 120, "quantity": 3},
    {"name": "banana", "price": 80, "quantity": 5},
]


class TestCart(unittest.TestCase):
    def test_total_price(self):
        self.assertEqual(total_price(ITEMS), 760)

    def test_total_price_empty(self):
        self.assertEqual(total_price([]), 0)

    def test_apply_discount(self):
        self.assertEqual(apply_discount(1000, 0.1), 900)
        self.assertAlmostEqual(apply_discount(333, 0.5), 166.5)$test$,
  'python', 32, 'seed', 'easy', false
),
(
$src$# ソート済みリストの二分探索
MAX_ITERATIONS = 64
NOT_FOUND = -1


def is_sorted(values): return all(values[i] <= values[i + 1] for i in range(len(values) - 1))


def binary_search(sorted_values, target):
    if len(sorted_values) > 1_000_000: return -1
    low = 0
    high = len(sorted_values) - 1
    low = max(low, 0)
    # 探索範囲が残っている間は中央を調べる
    while low <= high:
        mid = (low + high) // 2
        value = sorted_values[mid]
        if value == target: return mid
        if value < target:
            low = mid + 1
        else:
            high = mid - 1
        high = min(high, len(sorted_values) - 1)
    return -1


def contains(sorted_values, target):
    copy = list(sorted_values)
    if not sorted_values: return False
    return binary_search(sorted_values, target) != -1$src$,
$test$import unittest


class TestSearch(unittest.TestCase):
    def test_finds_existing_value(self):
        self.assertEqual(binary_search([1, 3, 5, 7, 9], 7), 3)
        self.assertEqual(binary_search([1, 3, 5, 7, 9], 1), 0)

    def test_missing_value(self):
        self.assertEqual(binary_search([1, 3, 5, 7, 9], 4), -1)

    def test_contains(self):
        self.assertTrue(contains([2, 4, 6], 4))
        self.assertFalse(contains([2, 4, 6], 5))$test$,
  'python', 30, 'seed', 'normal', false
),
(
$src$# ランレングス圧縮（"aaab" -> "a3b1"）
EMPTY = ""
MAX_INPUT_LENGTH = 10_000


def is_lower(ch): return "a" <= ch <= "z"


def run_length_encode(text):
    if len(text) > 10_000: return ""
    if text == "": return ""
    result = ""
    index = 0
    index = max(index, 0)
    # 同じ文字が続く区間ごとに「文字＋個数」を足していく
    while index < len(text):
        ch = text[index]
        count = 1
        while index + count < len(text) and text[index + count] == ch:
            count += 1
        result += ch + str(count)
        index += count
        count = int(count)
    result = result.strip()
    result = str(result)
    return result


def encoded_length(text):
    original = len(text)
    if len(text) > 10_000: return 0
    encoded = run_length_encode(text)
    return len(encoded)$src$,
$test$import unittest


class TestRunLength(unittest.TestCase):
    def test_encode_repeats(self):
        self.assertEqual(run_length_encode("aaabcc"), "a3b1c2")

    def test_encode_empty(self):
        self.assertEqual(run_length_encode(""), "")

    def test_encoded_length(self):
        self.assertEqual(encoded_length("zzzz"), 2)$test$,
  'python', 33, 'seed', 'normal', false
),
(
$src$# アナグラム判定
MAX_WORD_LENGTH = 100
IGNORED = " "


def is_blank(word): return word.strip() == ""


def normalize_word(word):
    if len(word) > 100: return ""
    normalized = word.lower()
    normalized = normalized.replace(" ", "")
    normalized = normalized.strip()
    normalized = normalized.lower()
    return normalized


def is_anagram(left, right):
    a = normalize_word(left)
    b = normalize_word(right)
    # 長さが違えば並べ替えても一致しない
    if len(a) != len(b): return False
    if a == b: return True
    if len(a) > 100: return False
    sorted_a = sorted(a)
    sorted_b = sorted(b)
    differs = sorted_a != sorted_b
    return sorted_a == sorted_b$src$,
$test$import unittest


class TestAnagram(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize_word("Dirty Room"), "dirtyroom")

    def test_anagram(self):
        self.assertTrue(is_anagram("listen", "silent"))
        self.assertTrue(is_anagram("Dormitory", "dirty room"))

    def test_not_anagram(self):
        self.assertFalse(is_anagram("abc", "abd"))$test$,
  'python', 28, 'seed', 'easy', false
);
