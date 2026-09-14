// 自分が「どの部屋のどのプレイヤーか」をタブ単位で覚えておく小さなストア。
// sessionStorage を直接 useState の初期値にするとサーバー描画とズレるので、
// useSyncExternalStore から読めるようにしてある。

export interface Identity {
  roomId: string;
  playerId: string;
}

const KEY = "code_jenga_identity";

let cached: Identity | null | undefined;
const subscribers = new Set<() => void>();

function read(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/** 同じ参照を返し続ける必要があるのでキャッシュする */
export function getIdentitySnapshot(): Identity | null {
  if (cached === undefined) cached = read();
  return cached;
}

/** サーバー描画時は常に「部屋に入っていない」状態 */
export function getServerIdentitySnapshot(): Identity | null {
  return null;
}

export function setIdentity(next: Identity | null) {
  cached = next;

  if (typeof window !== "undefined") {
    try {
      if (next) {
        window.sessionStorage.setItem(KEY, JSON.stringify(next));
      } else {
        window.sessionStorage.removeItem(KEY);
      }
    } catch {
      // プライベートモードなどでは諦める（リロードで部屋から抜けるだけ）
    }
  }

  subscribers.forEach((fn) => fn());
}
