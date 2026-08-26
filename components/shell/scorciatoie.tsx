"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { updateSearch } from "@/lib/shallow-nav";

/**
 * Scorciatoie a lettera singola.
 *
 * Ctrl+K apre la palette e va bene per cercare; ma le tre destinazioni di
 * tutti i giorni — i task, un task nuovo, i progetti — meritano un tasto.
 *
 * Il pericolo delle scorciatoie a lettera singola è ovvio: chi scrive
 * «Preparare il preventivo» in un campo di testo non deve ritrovarsi nei
 * Progetti. Per questo si controlla dove sta il fuoco prima di fare
 * qualunque cosa, e si lascia perdere se c'è di mezzo un modificatore —
 * Ctrl+P è la stampa, e non si ruba a nessuno una scorciatoia del browser.
 */

const TASTI: Record<string, { dove: string; cosa: string }> = {
  t: { dove: "/tasks", cosa: "Task" },
  p: { dove: "/projects", cosa: "Progetti" },
};

/** Il fuoco è su qualcosa che accetta testo? */
function staScrivendo(): boolean {
  const nodo = document.activeElement as HTMLElement | null;
  if (!nodo) return false;
  const tag = nodo.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    nodo.isContentEditable
  );
}

export function Scorciatoie() {
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* Con un modificatore la combinazione è di qualcun altro: del
         browser, del sistema, o della palette. */
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (staScrivendo()) return;
      /* Un pannello aperto ha le sue regole (Esc per chiudere, frecce per
         scorrere): saltarci dentro da sotto sarebbe una sorpresa. */
      if (document.querySelector('[role="dialog"]')) return;

      const tasto = e.key.toLowerCase();

      /* «N» come nuovo: apre la creazione di un task ovunque ci si trovi.
         Passa dall'indirizzo, quindi funziona anche con il tasto indietro. */
      if (tasto === "n") {
        e.preventDefault();
        updateSearch({ task: "new" });
        return;
      }

      const meta = TASTI[tasto];
      if (!meta) return;
      e.preventDefault();
      router.push(meta.dove, { scroll: false });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
