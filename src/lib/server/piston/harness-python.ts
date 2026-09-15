// 担当: BE-B
// Piston 上で動く Python 用テストハーネス。
//
// TypeScript 版（harness.ts）は Vitest の describe / it / expect を自作シムで再現しているが、
// Python には標準ライブラリの unittest があるので、シムは作らず unittest をそのまま使う。
// ハーネスの役割は「unittest の結果を TS 版と同じマーカー行に変換する」ことだけ。
// これで classify.ts / parse-vitest.ts は言語を知らないまま判定・集計できる。
//
// 制約（harness.ts と同じ）:
// - Piston の output_max_size を超えるとプロセスが SIGKILL される（status 'OL'）ため、
//   プレイヤーの print を捨て、サマリ JSON も 800 バイトに収める。
// - ハーネス自身の障害はプレイヤーのアウトにしない（__CJ_ERROR__ を出して exit 0）。
// 純粋モジュール（"server-only" を付けない）。

import { CJ_ERROR_MARKER, CJ_SUMMARY_MARKER } from "./markers";

/**
 * Gemini プロンプトに載せる「使ってよい unittest のアサーション」。
 * TS 版の CJ_SUPPORTED_MATCHERS と違い実装は不要（unittest 本体が持っている）。
 * 生成されるテストの揺れを抑えるための周知が目的。
 */
export const CJ_PY_SUPPORTED_ASSERTIONS = [
  "assertEqual",
  "assertNotEqual",
  "assertTrue",
  "assertFalse",
  "assertIsNone",
  "assertIsNotNone",
  "assertIn",
  "assertNotIn",
  "assertAlmostEqual",
  "assertRaises",
  "assertIsInstance",
  "assertGreater",
  "assertGreaterEqual",
  "assertLess",
  "assertLessEqual",
  "assertCountEqual",
] as const;

export const CJ_PY_HARNESS_PRELUDE = String.raw`
# ---- codejenga python harness prelude ----
import io as __cj_io
import json as __cj_json
import sys as __cj_sys
import unittest

# stdout を差し替える前に実物を掴んでおく（マーカー行はこちらへ書く）。
__cj_real_stdout = __cj_sys.stdout


class __CjSink(__cj_io.TextIOBase):
    # プレイヤーの print を捨てる。StringIO だと print の無限ループでメモリを食うため write は no-op。
    def write(self, s):
        return len(s)

    def flush(self):
        pass


__cj_sys.stdout = __CjSink()


def __cj_write(line):
    print(line, file=__cj_real_stdout, flush=True)


def __cj_clip(text, limit):
    s = " ".join(str(text).split())
    return s if len(s) <= limit else s[:limit]


def __cj_failure_line(test, trace):
    # traceback の最終行（例: AssertionError: 6 != 7）だけを残す。
    lines = [l for l in str(trace).strip().splitlines() if l.strip()]
    detail = lines[-1] if lines else "失敗"
    return __cj_clip(test.id(), 80) + ": " + __cj_clip(detail, 120)


def __cj_emit_summary(summary):
    line = "` + CJ_SUMMARY_MARKER + String.raw`" + __cj_json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
    # 日本語が入るので文字数ではなく UTF-8 バイト数で測る（harness.ts の 800 バイト制限と揃える）。
    if len(line.encode("utf-8")) > 800:
        line = "` + CJ_SUMMARY_MARKER + String.raw`" + __cj_json.dumps(
            {"total": summary["total"], "passed": summary["passed"], "failed": summary["failed"]},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    __cj_write(line)


def __cj_run():
    # unittest.main() は argv を解釈し stderr にレポートを吐くので使わない。
    suite = unittest.TestLoader().loadTestsFromModule(__cj_sys.modules["__main__"])
    result = unittest.TextTestRunner(stream=__CjSink(), verbosity=0).run(suite)
    entries = list(result.failures) + list(result.errors)
    failures = [__cj_failure_line(t, m) for (t, m) in entries]
    unexpected = list(getattr(result, "unexpectedSuccesses", []))
    for t in unexpected:
        failures.append(__cj_clip(t.id(), 80) + ": 失敗するはずのテストが成功しました")
    total = result.testsRun
    skipped = len(getattr(result, "skipped", []))
    failed = len(entries) + len(unexpected)
    passed = total - failed - skipped
    if passed < 0:
        passed = 0
    if total == 0:
        # テスト0件でも exit 0 になりうるので、ここで失敗に倒す（harness.ts と同じ）。
        failures.append("テストが1件も登録されていません")
        failed = 1
    __cj_emit_summary({"total": total, "passed": passed, "failed": failed, "failures": failures})
    return failed


def __cj_main():
    try:
        failed = __cj_run()
    except BaseException as e:
        # ハーネス自身の障害・プレイヤーコードのモジュールレベル sys.exit などはアウトにしない。
        __cj_write(
            "` + CJ_ERROR_MARKER + String.raw`"
            + __cj_json.dumps({"message": __cj_clip(e, 300)}, ensure_ascii=False, separators=(",", ":"))
        )
        __cj_sys.stdout = __cj_real_stdout
        __cj_sys.exit(0)
    # 重要: sys.exit は SystemExit 例外なので、必ず try を抜けてから呼ぶ。
    # try の内側で呼ぶと上の except BaseException に食われ、失敗が exit 0（= passed）になる。
    __cj_sys.stdout = __cj_real_stdout
    __cj_sys.exit(1 if failed > 0 else 0)
# ---- end prelude ----
`;

export const CJ_PY_HARNESS_EPILOGUE = String.raw`
# ---- codejenga python harness epilogue ----
__cj_main()
`;
