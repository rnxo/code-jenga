// 画面の高さを読むための外部ストア。担当: ようた（見た目）
//
// 結果画面は縦スクロールを出したくないので、「崩れたタワーにどれだけ高さを
// 割けるか」を画面の高さから決める必要がある。
//
// useEffect で測って setState する形は、このリポジトリの
// react-hooks/set-state-in-effect に引っかかる。resize は本来こちら（ブラウザ）
// 側の出来事なので、useSyncExternalStore で購読するのが素直。
//
// 読むのは window.innerHeight だけで、要素のレイアウトは測らない。

const listeners = new Set<() => void>();
let height = 0;

function handleResize() {
  const next = window.innerHeight;
  if (next === height) {
    return;
  }
  height = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeViewportHeight(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("resize", handleResize);
  }
  listeners.add(listener);
  // ここで初めて実際の高さを入れる。React は購読の直後にもう一度
  // スナップショットを読むので、変わっていれば描き直してくれる
  height = window.innerHeight;
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("resize", handleResize);
    }
  };
}

/**
 * いまの画面の高さ。購読が始まるまでは 0。
 *
 * ここで window.innerHeight を直接返してはいけない。サーバー側は 0 なので、
 * ハイドレーションの時点で値が食い違い、React が木を作り直して
 * ルート全体が読み込み中のまま止まる（実際に踏んだ）。
 *
 * 購読が始まった時点で本当の高さが入り、React が読み直して描き直す。
 */
export function getViewportHeight(): number {
  return height;
}

/** サーバー側では分からない。0 を返し、呼び出し側は「制限なし」として扱う */
export function getServerViewportHeight(): number {
  return 0;
}
