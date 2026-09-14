// Supabase の環境変数が無いときに使う、localStorage ベースの代替クライアント。
// hooks が使う API（from().select().eq()/.order() / insert().select() /
// update().eq() / delete().eq() / channel().on().subscribe() / removeChannel）
// だけを同じ形で実装しています。
// 同一ブラウザの別タブ同士なら BroadcastChannel で同期するので、
// タブを4つ開けば4人プレイの確認まではできます（別端末とは同期しません）。

type Row = Record<string, unknown>;
type Result<T> = Promise<{ data: T; error: { message: string } | null }>;
type ChangeHandler = (payload: { eventType: string; table: string }) => void;
type SubscribeCallback = (status: string) => void;

interface LocalChannel {
  on(event: string, filter: { table?: string }, handler: ChangeHandler): LocalChannel;
  subscribe(callback?: SubscribeCallback): LocalChannel;
  __teardown(): void;
}

const PREFIX = "code_jenga_local:";
const isBrowser = typeof window !== "undefined";

const listeners = new Set<(table: string) => void>();
let broadcast: BroadcastChannel | null = null;

if (isBrowser) {
  if ("BroadcastChannel" in window) {
    broadcast = new BroadcastChannel("code_jenga_local_sync");
    broadcast.onmessage = (e) => notify(String(e.data ?? ""), false);
  }
  // BroadcastChannel 非対応環境向けの保険
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith(PREFIX)) notify(e.key.slice(PREFIX.length), false);
  });
}

function notify(table: string, alsoBroadcast = true) {
  if (alsoBroadcast) broadcast?.postMessage(table);
  listeners.forEach((fn) => fn(table));
}

function readRows(table: string): Row[] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + table);
    return raw ? (JSON.parse(raw) as Row[]) : [];
  } catch {
    return [];
  }
}

function writeRows(table: string, rows: Row[]) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(PREFIX + table, JSON.stringify(rows));
  } catch {
    // 容量超過などは無視する
  }
  notify(table);
}

function newId(): string {
  if (isBrowser && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** eq で絞り込みつつ order/single まで繋げられる、読み取り用のチェーン */
function selectChain(table: string, filters: Array<[string, unknown]> = []) {
  const rows = () =>
    readRows(table).filter((row) => filters.every(([col, val]) => row[col] === val));

  const chain = {
    eq(column: string, value: unknown) {
      return selectChain(table, [...filters, [column, value]]);
    },
    order(column: string, opts?: { ascending?: boolean }) {
      const direction = opts?.ascending === false ? -1 : 1;
      const sorted = [...rows()].sort((a, b) => {
        const [x, y] = [a[column], b[column]];
        if (typeof x === "number" && typeof y === "number") return (x - y) * direction;
        return String(x).localeCompare(String(y)) * direction;
      });
      return Promise.resolve({ data: sorted, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: rows()[0] ?? null, error: null });
    },
    single() {
      const row = rows()[0];
      return Promise.resolve({
        data: row ?? null,
        error: row ? null : { message: "見つかりませんでした" },
      });
    },
    then<T>(resolve: (v: { data: Row[]; error: null }) => T) {
      return Promise.resolve({ data: rows(), error: null }).then(resolve);
    },
  };

  return chain;
}

export function createLocalFallbackClient() {
  return {
    from(table: string) {
      return {
        select() {
          return selectChain(table);
        },

        insert(rows: Row[]) {
          const now = new Date().toISOString();
          const added = rows.map((row) => ({ id: newId(), created_at: now, ...row }));
          writeRows(table, [...readRows(table), ...added]);

          const result = { data: added, error: null };
          return {
            select: () => ({
              single: () => Promise.resolve({ data: added[0] ?? null, error: null }),
              then: <T,>(resolve: (v: typeof result) => T) =>
                Promise.resolve(result).then(resolve),
            }),
            then: <T,>(resolve: (v: typeof result) => T) =>
              Promise.resolve(result).then(resolve),
          };
        },

        update(patch: Row) {
          return {
            eq(column: string, value: unknown): Result<null> {
              writeRows(
                table,
                readRows(table).map((row) =>
                  row[column] === value ? { ...row, ...patch } : row,
                ),
              );
              return Promise.resolve({ data: null, error: null });
            },
          };
        },

        delete() {
          return {
            eq(column: string, value: unknown): Result<null> {
              writeRows(
                table,
                readRows(table).filter((row) => row[column] !== value),
              );
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },

    channel(): LocalChannel {
      const handlers: Array<{ table?: string; handler: ChangeHandler }> = [];

      const fire = (table: string) => {
        handlers.forEach(({ table: want, handler }) => {
          if (!want || want === table) handler({ eventType: "local", table });
        });
      };

      const channel: LocalChannel = {
        on(_event, filter, handler) {
          handlers.push({ table: filter?.table, handler });
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
