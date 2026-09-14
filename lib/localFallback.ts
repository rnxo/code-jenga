// Supabase の環境変数が無いときに使う、localStorage ベースの代替クライアント。
// page.tsx が使う API（from().select().order() / insert / delete().eq() /
// channel().on().subscribe() / removeChannel）だけを同じ形で実装しています。
// 同一ブラウザの別タブ同士なら BroadcastChannel でリアルタイム同期します。

type Row = Record<string, unknown>;
type ChangePayload = { eventType: string };
type ChangeHandler = (payload: ChangePayload) => void;
type SubscribeCallback = (status: string) => void;

interface LocalChannel {
  on(event: string, filter: unknown, handler: ChangeHandler): LocalChannel;
  subscribe(callback?: SubscribeCallback): LocalChannel;
  __teardown(): void;
}

const KEY = "jenga_blocks_local";
const isBrowser = typeof window !== "undefined";

const listeners = new Set<() => void>();
let broadcast: BroadcastChannel | null = null;

if (isBrowser) {
  if ("BroadcastChannel" in window) {
    broadcast = new BroadcastChannel("jenga_local_sync");
    broadcast.onmessage = () => listeners.forEach((fn) => fn());
  }
  // BroadcastChannel 非対応環境向けの保険
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) listeners.forEach((fn) => fn());
  });
}

function readRows(): Row[] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Row[]) : [];
  } catch {
    return [];
  }
}

function writeRows(rows: Row[]) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // 容量超過などは無視する
  }
  broadcast?.postMessage("changed");
  listeners.forEach((fn) => fn());
}

function newId(): string {
  if (isBrowser && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createLocalFallbackClient() {
  return {
    from() {
      return {
        select() {
          return {
            order(column: string, opts?: { ascending?: boolean }) {
              const direction = opts?.ascending === false ? -1 : 1;
              const data = [...readRows()].sort(
                (a, b) => (Number(a[column]) - Number(b[column])) * direction,
              );
              return Promise.resolve({ data, error: null });
            },
          };
        },
        insert(rows: Row[]) {
          const created_at = new Date().toISOString();
          const added = rows.map((row) => ({ id: newId(), created_at, ...row }));
          writeRows([...readRows(), ...added]);
          return Promise.resolve({ data: added, error: null });
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              writeRows(readRows().filter((row) => row[column] !== value));
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },

    channel(): LocalChannel {
      const handlers: ChangeHandler[] = [];
      const fire = () => handlers.forEach((h) => h({ eventType: "local" }));

      const channel: LocalChannel = {
        on(_event, _filter, handler) {
          handlers.push(handler);
          return channel;
        },
        subscribe(callback) {
          listeners.add(fire);
          // Supabase の subscribe と同じく、購読確立を非同期で通知する
          if (callback) queueMicrotask(() => callback("SUBSCRIBED"));
          return channel;
        },
        __teardown() {
          listeners.delete(fire);
        },
      };

      return channel;
    },

    removeChannel(channel: { __teardown?: () => void }) {
      channel?.__teardown?.();
      return Promise.resolve("ok");
    },
  };
}
