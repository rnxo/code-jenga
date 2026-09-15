"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "./SillyTapSounds.module.css";
import { playSillySound, SILLY_SOUNDS } from "../silly-sounds";
import {
  getServerSoundMuted,
  isSoundMuted,
  subscribeSoundMuted,
  toggleSoundMuted,
} from "../sound-settings";

// セクションを叩くと突拍子のない音が鳴る。担当: ようた（見た目）
//
// 画面ごとに仕掛けを置くのではなく、document で1回だけ拾って、
// 叩かれた場所から「どのセクションか」を引く。こうしておくと、
// 後から増えた画面にも勝手に付いてくる。
//
// 音はセクションごとに固定。場所と音が結びついているほうが、
// 触っているうちに気づけて楽しい。

/**
 * セクションと見なす単位。まず意味のある区切りを探し、
 * 無ければ main の直下の塊（＝どのページも縦に積んでいる単位）まで戻る。
 */
const SECTION_SELECTOR = "[data-silly-sound], section, header, article, aside, main > *";

/** ここを叩いても鳴らさない。音を切るボタン自身が鳴るのはおかしい */
const SILENT_SELECTOR = "[data-no-silly]";

export function SillyTapSounds() {
  const muted = useSyncExternalStore(subscribeSoundMuted, isSoundMuted, getServerSoundMuted);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest(SILENT_SELECTOR)) {
        return;
      }
      const section = target.closest(SECTION_SELECTOR);
      if (!section) {
        return;
      }
      playSillySound(soundForSection(section));
    }

    // capture で拾う。途中で伝播を止める作りがあっても取りこぼさない。
    // passive なので、既存の操作（ドラッグ回転やクリック）の邪魔はしない。
    document.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, []);

  return (
    <button
      type="button"
      data-no-silly
      className={styles.toggle}
      aria-pressed={muted}
      aria-label={muted ? "効果音を鳴らす" : "効果音を消す"}
      title={muted ? "効果音: オフ" : "効果音: オン"}
      onClick={toggleSoundMuted}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

/**
 * そのセクションに割り当てられた音。
 *
 * `data-silly-sound="quack"` と書いてあればそれを使う。無ければ、
 * セクションの素性（タグと、親の中で何番目か）から決める。同じ場所なら
 * 毎回同じ音になり、隣り合うセクションは別の音になる。
 */
function soundForSection(section: Element) {
  const named = section.getAttribute("data-silly-sound");
  if (named && (SILLY_SOUNDS as readonly string[]).includes(named)) {
    return named as (typeof SILLY_SOUNDS)[number];
  }

  const siblings = section.parentElement ? [...section.parentElement.children] : [];
  const key = `${section.tagName}:${siblings.indexOf(section)}:${section.className}`;
  return SILLY_SOUNDS[hash(key) % SILLY_SOUNDS.length];
}

/** 文字列から数を作るだけ。散らばりさえすれば中身は何でもよい */
function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) >>> 0;
  }
  return result;
}
