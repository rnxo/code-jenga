import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JengaTower } from "./JengaTower";

// 行数が増えたときにタワーが画面を突き抜けないことを見張る。
//
// タワーは内部スクロールしない（ドラッグ回転とぶつかるため）ので、行数が増えると
// そのままページが下に伸び、削除ボタンや判定パネルが画面外へ行く。
// Brainfuck のお題は 15〜50 行あるので、詰め方と縮小率をここで固めておく。

function towerOf(lineCount: number): HTMLElement {
  const code = Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join("\n");
  const { container } = render(
    <JengaTower
      code={code}
      selectedLineNo={null}
      onSelectLine={() => {}}
      interactive={false}
      collapsed={false}
      silent
    />,
  );
  const tower = container.querySelector<HTMLElement>("[style*='--tower-zoom']");
  if (!tower) {
    throw new Error("タワーが見つかりません");
  }
  return tower;
}

/** その行数でのタワーのおおよその高さ（px）。1段ぶんの実測値 × 行数 × 縮小率 */
function estimatedHeight(tower: HTMLElement, lineCount: number, perLine: number): number {
  const zoom = Number(tower.style.getPropertyValue("--tower-zoom"));
  return lineCount * perLine * zoom;
}

describe("JengaTower の詰め方", () => {
  it("行数が増えるほど段が薄くなる", () => {
    const heights = [8, 14, 20, 30, 40, 50].map(
      (n) => towerOf(n).style.getPropertyValue("--piece-min-height"),
    );
    const asNumbers = heights.map((h) => Number.parseInt(h, 10));

    // 単調に小さくなる（同じ段に落ちることはないよう、代表値を選んである）
    for (let i = 1; i < asNumbers.length; i += 1) {
      expect(asNumbers[i]).toBeLessThan(asNumbers[i - 1]);
    }
  });

  it("ふつうの行数では縮小しない", () => {
    for (const lineCount of [6, 10, 14]) {
      expect(towerOf(lineCount).style.getPropertyValue("--tower-zoom")).toBe("1");
    }
  });

  it("Brainfuck の上限（50行）でも画面1枚半に収まる", () => {
    const lineCount = 50;
    const tower = towerOf(lineCount);
    const zoom = Number(tower.style.getPropertyValue("--tower-zoom"));

    expect(zoom).toBeLessThan(1);
    // 50行の詰め方は1段 25px。縮小後の高さで見る
    expect(estimatedHeight(tower, lineCount, 25)).toBeLessThanOrEqual(900);
  });

  it("どれだけ行数が増えても、木片が潰れるほどは縮めない", () => {
    for (const lineCount of [80, 200, 1000]) {
      const zoom = Number(towerOf(lineCount).style.getPropertyValue("--tower-zoom"));
      expect(zoom).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("行数が増えても全部の行が積まれる（間引かない）", () => {
    // 前のテストの描画も同じ document に残るので、この描画の中だけを見る
    const { container } = render(
      <JengaTower
        code={Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n")}
        selectedLineNo={null}
        onSelectLine={() => {}}
        interactive={false}
        collapsed={false}
        silent
      />,
    );
    expect(within(container).getAllByRole("button", { name: /行目/ })).toHaveLength(50);
  });
});
