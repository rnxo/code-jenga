// 担当: BE-B
// Piston 上で Vitest の代わりに動く最小テストハーネス（describe / it / expect のシム）。
// Piston のサンドボックスには npm もネットワークも無く Vitest 本体は動かないため、
// このプレリュード＋対象コード＋テストコード＋エピローグを1ファイルに合成して実行する（compose.ts）。
//
// 制約:
// - 型注釈を一切使わず「そのまま JS として妥当な TS」で書く。deno / tsc の両方で動き、
//   かつ Vitest から new Function で評価して自己テストできるようにするため（harness.test.ts）。
// - Piston の output_max_size は既定 1024 バイト。超えるとプロセスが SIGKILL される（status 'OL'）ため、
//   console 出力をプレリュードで無効化し、サマリ JSON も 800 バイトに収める。
// - process.exit() は呼ばない（パイプが flush される前に落ちるとマーカー行が消える）。
// 純粋モジュール（"server-only" を付けない）。

// マーカー定数の実体は markers.ts に置いている（Python ハーネスと共有するため）。
// classify.ts / parse-vitest.ts の既存 import パスを壊さないよう、ここから re-export する。
export { CJ_ERROR_MARKER, CJ_SUMMARY_MARKER } from "./markers";

/** ハーネスが対応しているマッチャー（Gemini プロンプトの制約にも使う）。 */
export const CJ_SUPPORTED_MATCHERS = [
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toBeTruthy",
  "toBeFalsy",
  "toBeNull",
  "toBeUndefined",
  "toBeDefined",
  "toBeNaN",
  "toBeCloseTo",
  "toContain",
  "toHaveLength",
  "toHaveProperty",
  "toThrow",
  "toThrowError",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toMatch",
  "toBeInstanceOf",
] as const;

export const CJ_HARNESS_PRELUDE = String.raw`
// ---- codejenga harness prelude ----
var __cjWrite = (function () {
  var log = console.log.bind(console);
  return function (line) { log(line); };
})();
console.log = function () {};
console.info = function () {};
console.warn = function () {};
console.error = function () {};
console.debug = function () {};
var __cjTests = [];
var __cjSuiteStack = [];
var __cjBeforeEach = [];
var __cjAfterEach = [];
var __cjBeforeAll = [];
var __cjAfterAll = [];
function __cjHarnessError(message) {
  var err = new Error(message);
  err.__cjHarness = true;
  return err;
}
function describe(name, fn) {
  __cjSuiteStack.push(String(name));
  try { fn(); } finally { __cjSuiteStack.pop(); }
}
function it(name, fn) {
  __cjTests.push({ name: __cjSuiteStack.concat([String(name)]).join(" > "), fn: fn });
}
var test = it;
function beforeEach(fn) { __cjBeforeEach.push(fn); }
function afterEach(fn) { __cjAfterEach.push(fn); }
function beforeAll(fn) { __cjBeforeAll.push(fn); }
function afterAll(fn) { __cjAfterAll.push(fn); }
function __cjStr(v) {
  try {
    if (typeof v === "string") return JSON.stringify(v);
    if (v instanceof Map) return "Map(" + JSON.stringify(Array.from(v.entries())) + ")";
    if (v instanceof Set) return "Set(" + JSON.stringify(Array.from(v.values())) + ")";
    if (typeof v === "function") return "[Function]";
    if (typeof v === "bigint") return String(v) + "n";
    var s = JSON.stringify(v);
    return s === undefined ? String(v) : s;
  } catch (e) { return String(v); }
}
function __cjDeepEqual(a, b, strict) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    var ok = true;
    a.forEach(function (v, k) { if (!b.has(k) || !__cjDeepEqual(v, b.get(k), strict)) ok = false; });
    return ok;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    var all = true;
    a.forEach(function (v) { if (!b.has(v)) all = false; });
    return all;
  }
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  var ka = Object.keys(a), kb = Object.keys(b);
  if (!strict) {
    ka = ka.filter(function (k) { return a[k] !== undefined; });
    kb = kb.filter(function (k) { return b[k] !== undefined; });
  }
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
    if (!__cjDeepEqual(a[ka[i]], b[ka[i]], strict)) return false;
  }
  return true;
}
function __cjCallThrows(fn, expected) {
  if (typeof fn !== "function") throw __cjHarnessError("toThrow には関数を渡してください");
  var thrown = null, did = false;
  try { fn(); } catch (e) { did = true; thrown = e; }
  if (!did) return false;
  if (expected === undefined) return true;
  var msg = thrown instanceof Error ? thrown.message : String(thrown);
  if (typeof expected === "string") return msg.indexOf(expected) !== -1;
  if (expected instanceof RegExp) return expected.test(msg);
  if (typeof expected === "function") return thrown instanceof expected;
  if (expected && typeof expected.message === "string") return msg === expected.message;
  return true;
}
function __cjMatchers(received, negate) {
  function check(pass, description) {
    if (pass === negate) {
      throw new Error("expected " + __cjStr(received) + (negate ? " not " : " ") + description);
    }
  }
  var m = {
    toBe: function (e) { check(Object.is(received, e), "to be " + __cjStr(e)); },
    toEqual: function (e) { check(__cjDeepEqual(received, e, false), "to equal " + __cjStr(e)); },
    toStrictEqual: function (e) { check(__cjDeepEqual(received, e, true), "to strictly equal " + __cjStr(e)); },
    toBeTruthy: function () { check(!!received, "to be truthy"); },
    toBeFalsy: function () { check(!received, "to be falsy"); },
    toBeNull: function () { check(received === null, "to be null"); },
    toBeUndefined: function () { check(received === undefined, "to be undefined"); },
    toBeDefined: function () { check(received !== undefined, "to be defined"); },
    toBeNaN: function () { check(typeof received === "number" && isNaN(received), "to be NaN"); },
    toBeCloseTo: function (e, digits) {
      var d = digits === undefined ? 2 : digits;
      check(Math.abs(received - e) < Math.pow(10, -d) / 2, "to be close to " + __cjStr(e));
    },
    toContain: function (e) {
      var has = typeof received === "string" ? received.indexOf(e) !== -1
        : (received && typeof received.includes === "function") ? received.includes(e)
        : Array.from(received).indexOf(e) !== -1;
      check(has, "to contain " + __cjStr(e));
    },
    toHaveLength: function (n) { check(received != null && received.length === n, "to have length " + n); },
    toHaveProperty: function (path, value) {
      var parts = Array.isArray(path) ? path : String(path).split(".");
      var cur = received, found = cur != null;
      for (var i = 0; i < parts.length && found; i++) {
        if (cur == null || !(parts[i] in Object(cur))) { found = false; break; }
        cur = cur[parts[i]];
      }
      if (arguments.length >= 2) found = found && __cjDeepEqual(cur, value, false);
      check(found, "to have property " + parts.join("."));
    },
    toThrow: function (e) { check(__cjCallThrows(received, e), "to throw" + (e === undefined ? "" : " " + __cjStr(e))); },
    toBeGreaterThan: function (e) { check(received > e, "to be greater than " + __cjStr(e)); },
    toBeGreaterThanOrEqual: function (e) { check(received >= e, "to be >= " + __cjStr(e)); },
    toBeLessThan: function (e) { check(received < e, "to be less than " + __cjStr(e)); },
    toBeLessThanOrEqual: function (e) { check(received <= e, "to be <= " + __cjStr(e)); },
    toMatch: function (e) {
      var s = String(received);
      check(e instanceof RegExp ? e.test(s) : s.indexOf(String(e)) !== -1, "to match " + __cjStr(e));
    },
    toBeInstanceOf: function (c) { check(received instanceof c, "to be instance of " + (c && c.name)); },
  };
  m.toThrowError = m.toThrow;
  return new Proxy(m, {
    get: function (target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "string" && prop.indexOf("to") === 0) {
        throw __cjHarnessError("未対応のマッチャーです: " + prop);
      }
      return undefined;
    },
  });
}
function expect(received) {
  var m = __cjMatchers(received, false);
  Object.defineProperty(m, "not", { value: __cjMatchers(received, true) });
  return m;
}
function __cjExit(code) {
  if (typeof __cjOnExit === "function") { __cjOnExit(code); return; }
  if (typeof Deno !== "undefined" && Deno && typeof Deno.exit === "function") { Deno.exit(code); return; }
  if (typeof process !== "undefined" && process) { process.exitCode = code; }
}
function __cjEmitSummary(summary) {
  var line = "__CJ_SUMMARY__" + JSON.stringify(summary);
  if (line.length > 800) {
    line = "__CJ_SUMMARY__" + JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed });
  }
  __cjWrite(line);
}
function __cjSeq(fns) {
  return fns.reduce(function (p, f) { return p.then(function () { return f(); }); }, Promise.resolve());
}
function __cjRun() {
  var passed = 0, failures = [], harnessFailure = null;
  function runOne(t) {
    return __cjSeq(__cjBeforeEach)
      .then(function () { return t.fn(); })
      .then(function () { return __cjSeq(__cjAfterEach); })
      .then(function () { passed++; }, function (e) {
        if (e && e.__cjHarness) { harnessFailure = e; return; }
        var msg = e instanceof Error ? e.message : String(e);
        failures.push(t.name + ": " + msg.slice(0, 120));
      });
  }
  return __cjSeq(__cjBeforeAll)
    .then(function () { return __cjSeq(__cjTests.map(function (t) { return function () { return runOne(t); }; })); })
    .then(function () { return __cjSeq(__cjAfterAll); })
    .then(function () {
      if (harnessFailure) {
        __cjWrite("__CJ_ERROR__" + JSON.stringify({ message: String(harnessFailure.message).slice(0, 300) }));
        __cjExit(0);
        return;
      }
      var total = __cjTests.length;
      var failed = total - passed;
      if (total === 0) { failures.push("テストが1件も登録されていません"); failed = 1; }
      __cjEmitSummary({ total: total, passed: passed, failed: failed, failures: failures });
      __cjExit(failed > 0 ? 1 : 0);
    }, function (e) {
      __cjWrite("__CJ_ERROR__" + JSON.stringify({ message: (e instanceof Error ? e.message : String(e)).slice(0, 300) }));
      __cjExit(0);
    });
}
// ---- end prelude ----
`;

export const CJ_HARNESS_EPILOGUE = String.raw`
// ---- codejenga harness epilogue ----
__cjRun();
`;
