// 盤面の行の寸法。担当: ようた（見た目）
//
// 3D のタワーと Monaco は「同じソースコードの別の見せ方」なので、
// 横に並べたときに N 行目どうしが同じ高さに来てほしい。
// そのためには両方が同じ行送りを使う必要があるので、ここに一本化する。
//
// どちらか片方だけ変えると静かにずれるため、必ずこの値を参照すること。

/** 1行ぶんの高さ（px）。Monaco の lineHeight と、タワーの段の間隔がこれで揃う */
export const LINE_HEIGHT_PX = 22;

/** 木片どうしの隙間（px）。段が地続きに見えないよう、わずかに空ける */
export const LINE_GAP_PX = 4;

/** 木片そのものの高さ。隙間とあわせて LINE_HEIGHT_PX になる */
export const PIECE_HEIGHT_PX = LINE_HEIGHT_PX - LINE_GAP_PX;

/** コードの1行目が始まるまでの余白（px）。Monaco の padding.top と揃える */
export const CODE_TOP_PADDING_PX = 12;

/** コード側の枠線の太さ（px）。タワーの上余白を合わせるときに足す */
export const CODE_BORDER_PX = 1;
