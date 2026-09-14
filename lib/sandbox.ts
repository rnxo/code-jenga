// Piston が使えないときのフォールバック実行環境。
//
// このゲームで一番危ないのは「1行抜かれたコードを実行する」ところなので、
// 次の5つを重ねて閉じ込めている:
//
// 1. sandbox="allow-scripts" のみ（allow-same-origin なし）
//    → 不透明オリジンになり、このアプリの DOM / localStorage / Cookie に触れない
// 2. CSP default-src 'none'
//    → 中から fetch / XHR / WebSocket / 画像読み込みが一切できない。外に持ち出せない
// 3. eval を使わない（'unsafe-eval' を許可しない）
//    → コードは <script> に直接埋めて実行する。文字列からの動的生成は塞いだまま
// 4. allow-popups / allow-top-navigation / allow-forms を付けない
//    → 別タブを開いたり、親ページを別サイトへ飛ばしたりできない
// 5. タイムアウトで iframe ごと破棄
//    → 同期の無限ループを書かれても、親のタイマーは別スレッドなので止められる
//
// TypeScript のコンパイラは載せていないため、素の JavaScript として評価されます。
// 型注釈まで含めて本物の実行環境で走らせたい場合は、Piston を自前ホストして
// PISTON_URL を設定してください（そちらはコンテナ単位で隔離されます）。

export interface SandboxResult {
  /** false ならタワー崩壊（例外・構文エラー・タイムアウト） */
  ok: boolean;
  output: string;
}

/** <script> の中に安全に埋め込めるようにする */
function escapeForScriptTag(code: string) {
  return code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

export function runInBrowserSandbox(
  code: string,
  timeoutMs = 4000,
): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const token = Math.random().toString(36).slice(2);

    // 中から外に出られないよう、ネットワークを全面的に塞ぐ。
    // eval を使わない作りなので 'unsafe-eval' は許可しない。
    const csp = "default-src 'none'; script-src 'unsafe-inline'";

    const html = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<script>
var __out = [];
var __ok = false;
var __err = null;

function __push(prefix, args) {
  __out.push(
    prefix +
      Array.prototype.map
        .call(args, function (a) {
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        })
        .join(' ')
  );
}

console.log = function () { __push('', arguments); };
console.info = console.log;
console.warn = console.log;
console.error = function () { __push('[error] ', arguments); };

// 構文エラーは try/catch では捕まらないのでここで拾う
window.onerror = function (message) {
  __err = String(message);
  return true;
};
<\/script>
<script>
try {
${escapeForScriptTag(code)}
  __ok = true;
} catch (e) {
  __err = '[' + (e && e.name ? e.name : 'Error') + '] ' + (e && e.message ? e.message : String(e));
}
<\/script>
<script>
if (!__ok && !__err) __err = '[SyntaxError] コードを解釈できませんでした';
if (__err) __out.push(__err);
parent.postMessage(
  { token: ${JSON.stringify(token)}, ok: __ok && !__err, output: __out.join('\\n') },
  '*'
);
<\/script>`;

    const frame = document.createElement("iframe");
    // allow-same-origin / allow-popups / allow-top-navigation は付けない
    frame.setAttribute("sandbox", "allow-scripts");
    // CSP Embedded Enforcement（対応ブラウザでは meta より強い）
    frame.setAttribute("csp", csp);
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
        output: e.data.ok ? out || "実行成功: タワーは持ちこたえました！" : out,
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
