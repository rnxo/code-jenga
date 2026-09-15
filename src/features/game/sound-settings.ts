// 効果音のオン・オフ。画面をまたいで1か所で持つ。担当: ようた（見た目）
//
// もともとタワーの中に閉じた state だったが、タップの音（silly-sounds）も
// 同じスイッチで黙らせたいので外に出した。
// その場かぎりの設定でよいので、保存はしない（リロードで鳴る側に戻る）。

let muted = false;
const listeners = new Set<() => void>();

export function isSoundMuted(): boolean {
  return muted;
}

/** サーバー側では常に「鳴る」。音は出ないので実害はない */
export function getServerSoundMuted(): boolean {
  return false;
}

export function subscribeSoundMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toggleSoundMuted(): void {
  setSoundMuted(!muted);
}

export function setSoundMuted(next: boolean): void {
  if (muted === next) {
    return;
  }
  muted = next;
  for (const listener of listeners) {
    listener();
  }
}
