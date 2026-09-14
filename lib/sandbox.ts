// Piston が使えないときのフォールバック実行環境。
// allow-same-origin を付けない sandbox iframe の中で動かすので、
// 投稿されたコードはこのアプリのオリジンにもホストマシンにも触れません。
// TypeScript のコンパイラは載せていないため、素の JavaScript として評価されます。

export interface SandboxResult {
  /** false ならタワー崩壊（例外・タイムアウト） */
  ok: boolean;
  output: string;
}

export function runInBrowserSandbox(
  code: string,
  timeoutMs = 4000,
): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const token = Math.random().toString(36).slice(2);

    const html = `<!doctype html><meta charset="utf-8"><script>
(function () {
  var lines = [];
  var push = function (kind, args) {
    lines.push(
      (kind === 'error' ? '[error] ' : '') +
        Array.prototype.map
          .call(args, function (a) {
            if (typeof a === 'string') return a;
            try { return JSON.stringify(a); } catch (e) { return String(a); }
          })
          .join(' ')
    );
  };
  console.log = function () { push('log', arguments); };
  console.info = console.log;
  console.warn = function () { push('log', arguments); };
  console.error = function () { push('error', arguments); };

  var ok = true;
  try {
    (0, eval)(${JSON.stringify(code)});
  } catch (e) {
    ok = false;
    lines.push('[' + (e && e.name ? e.name : 'Error') + '] ' + (e && e.message ? e.message : String(e)));
  }
  parent.postMessage({ token: ${JSON.stringify(token)}, ok: ok, output: lines.join('\\n') }, '*');
})();
<\/script>`;

    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.display = "none";

    let done = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
    };

    const onMessage = (e: MessageEvent) => {
      if (done) return;
      if (e.source !== frame.contentWindow) return;
      if (!e.data || e.data.token !== token) return;

      done = true;
      cleanup();

      const out = String(e.data.output ?? "");
      resolve({
        ok: Boolean(e.data.ok),
        output: e.data.ok ? out || "実行成功: タワーは安定しています！" : out,
      });
    };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve({
        ok: false,
        output: `実行が ${timeoutMs}ms を超えました（無限ループの可能性）`,
      });
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
