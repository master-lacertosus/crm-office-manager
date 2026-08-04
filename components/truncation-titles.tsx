"use client";

import * as React from "react";

/**
 * Tooltip nativo automatico sui testi troncati: al passaggio del mouse,
 * se l'elemento è davvero tagliato («…»), il suo `title` diventa il
 * testo completo. Un solo listener delegato per tutta l'app: copre
 * `truncate`, `text-ellipsis` e `line-clamp-*`, presenti e futuri.
 * I `title` scritti a mano (es. DueChip) non vengono mai toccati; se il
 * testo torna a starci, il title automatico viene rimosso.
 */
export function TruncationTitles() {
  React.useEffect(() => {
    const SELECTOR = '.truncate, .text-ellipsis, [class*="line-clamp-"]';
    const onOver = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest(SELECTOR);
      if (!(el instanceof HTMLElement)) return;

      const isAuto = el.dataset.autoTitle !== undefined;
      if (el.title && !isAuto) return; // title manuale: non interferire

      const clipped =
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1;
      if (clipped) {
        const text = (el.textContent ?? "").trim();
        if (text && el.title !== text) {
          el.title = text;
          el.dataset.autoTitle = "";
        }
      } else if (isAuto) {
        el.removeAttribute("title");
        delete el.dataset.autoTitle;
      }
    };
    document.addEventListener("mouseover", onOver);
    return () => document.removeEventListener("mouseover", onOver);
  }, []);
  return null;
}
