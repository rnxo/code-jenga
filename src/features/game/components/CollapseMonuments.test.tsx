import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapseMonuments } from "./CollapseMonuments";

// 勝敗でどちらの像が出るかを固める。
// 2体並べて片方を暗くする作りから、勝った側だけが出る作りに変えたので、
// 取り違えると「負けたのに自由の女神が出る」という一番まずい壊れ方をする。

function 出ている像(verdict: "win" | "lose" | null): string[] {
  const { container } = render(<CollapseMonuments verdict={verdict} />);
  return [...container.querySelectorAll("figcaption")].map((el) => el.textContent ?? "");
}

describe("CollapseMonuments", () => {
  it("勝ちなら自由の女神だけが出る", () => {
    expect(出ている像("win")).toEqual(["自由の女神"]);
  });

  it("負けなら奈良の大仏だけが出る", () => {
    expect(出ている像("lose")).toEqual(["奈良の大仏"]);
  });

  it("勝敗が分からないときは両方出る（観戦・未サインインなど）", () => {
    expect(出ている像(null)).toEqual(["自由の女神", "奈良の大仏"]);
  });

  it("出ている像には、その勝敗の札が付く", () => {
    const win = render(<CollapseMonuments verdict="win" />);
    expect(within(win.container).getByText("勝ち")).toBeTruthy();
    expect(within(win.container).queryByText("負け")).toBeNull();

    const lose = render(<CollapseMonuments verdict="lose" />);
    expect(within(lose.container).getByText("負け")).toBeTruthy();
    expect(within(lose.container).queryByText("勝ち")).toBeNull();
  });

  it("1体のときだけ、奥から飛び出す動きになる", () => {
    const solo = render(<CollapseMonuments verdict="win" />);
    const soloFigure = solo.container.querySelector("figure");
    // CSS Modules はクラス名をハッシュ化するので、末尾で見る
    expect(soloFigure?.className).toMatch(/monumentSolo/);

    const both = render(<CollapseMonuments verdict={null} />);
    for (const figure of both.container.querySelectorAll("figure")) {
      expect(figure.className).not.toMatch(/monumentSolo/);
    }
  });

  it("盤面（compact でない）で1体のときだけ、前面の衝撃が出る", () => {
    const 盤面 = render(<CollapseMonuments verdict="win" />);
    expect(盤面.container.querySelector('[class*="impactOverlay"]')).not.toBeNull();

    // 結果画面のカードは狭いので、画面いっぱいの衝撃は出さない
    const 結果 = render(<CollapseMonuments verdict="win" compact />);
    expect(結果.container.querySelector('[class*="impactOverlay"]')).toBeNull();

    // 勝敗が分からず2体並ぶときも出さない（飛び出しそのものが無いため）
    const 両方 = render(<CollapseMonuments verdict={null} />);
    expect(両方.container.querySelector('[class*="impactOverlay"]')).toBeNull();
  });

  it("前面の衝撃はクリックを通す（下のコードとボタンを塞がない）", () => {
    const { container } = render(<CollapseMonuments verdict="lose" />);
    const overlay = container.querySelector<HTMLElement>('[class*="impactOverlay"]');
    // 実際の pointer-events は CSS 側。ここでは aria から外していることを見る
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
  });
});
