// ルーム入室コード（DB_DESIGN.md 4.3: rooms.code, CHECK ^[A-Z0-9]{6}$）に関する純粋関数群。
// FE / BE どちらからも import してよい。

const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_CODE_LENGTH = 6;

/** rooms.code の CHECK 制約を満たす形式かどうかを検証する。 */
export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** ランダムな6桁英数字のルームコードを生成する。DB 側の UNIQUE 制約に衝突した場合は呼び出し側で再試行すること。 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[index];
  }
  return code;
}

/** ユーザー入力を rooms.code の形式へ正規化する（小文字→大文字化、前後の空白除去）。 */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}
