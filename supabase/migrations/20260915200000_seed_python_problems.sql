-- Gemini 障害時のフォールバック用シードお題（Python 版）。
-- 20260914140000_seed_problems.sql と同じ方針で is_verified は false で投入し、
-- Piston での事前検証（POST /api/problems/verify）を通してから true にする。
-- 手作業で true にすると「検証していないお題でゲームが始まる」穴が残るため、ここでは立てない。
--
-- ロビーで Python を選んだ試合は start-game.ts が
-- findVerifiedProblem({ generatedBy: 'seed', language: 'python' }) までフォールバックするので、
-- ここに Python のお題が1件も無いと Gemini が不調なときに必ず PROBLEM_GENERATION_FAILED になる。
--
-- テストは標準ライブラリの unittest で書く。対象コードと同じファイルに連結されるため
-- import unittest 以外の import は書かない（src/lib/server/piston/compose-python.ts）。

insert into public.problems (source_code, test_code, language, initial_line_count, generated_by, difficulty, is_verified)
values
(
$src$def sum_all(numbers):
    total = 0
    for n in numbers:
        total += n
    return total


def average(numbers):
    if len(numbers) == 0:
        return 0
    return sum_all(numbers) / len(numbers)


def largest(numbers):
    if len(numbers) == 0:
        return None
    best = numbers[0]
    for n in numbers:
        if n > best:
            best = n
    return best$src$,
$test$import unittest


class TestNumberStats(unittest.TestCase):
    def test_sum_all_adds_numbers(self):
        self.assertEqual(sum_all([1, 2, 3]), 6)

    def test_sum_all_of_empty_is_zero(self):
        self.assertEqual(sum_all([]), 0)

    def test_average_returns_mean(self):
        self.assertEqual(average([2, 4, 6]), 4)

    def test_average_of_empty_is_zero(self):
        self.assertEqual(average([]), 0)

    def test_largest_returns_max(self):
        self.assertEqual(largest([3, 9, 4]), 9)

    def test_largest_of_empty_is_none(self):
        self.assertIsNone(largest([]))$test$,
  'python', 21, 'seed', 'easy', false
),
(
$src$def fizz_buzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    if n % 3 == 0:
        return "Fizz"
    if n % 5 == 0:
        return "Buzz"
    return str(n)


def fizz_buzz_range(start, end):
    result = []
    for n in range(start, end + 1):
        result.append(fizz_buzz(n))
    return result$src$,
$test$import unittest


class TestFizzBuzz(unittest.TestCase):
    def test_multiple_of_three_is_fizz(self):
        self.assertEqual(fizz_buzz(3), "Fizz")

    def test_multiple_of_five_is_buzz(self):
        self.assertEqual(fizz_buzz(5), "Buzz")

    def test_multiple_of_fifteen_is_fizzbuzz(self):
        self.assertEqual(fizz_buzz(15), "FizzBuzz")

    def test_other_numbers_are_stringified(self):
        self.assertEqual(fizz_buzz(7), "7")

    def test_range_collects_results(self):
        self.assertEqual(fizz_buzz_range(1, 5), ["1", "2", "Fizz", "4", "Buzz"])$test$,
  'python', 15, 'seed', 'normal', false
);
