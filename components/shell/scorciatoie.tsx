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

/**
 * Le lettere e dove portano. Vive qui ed è esportata perché la barra
 * laterale le mostri accanto alle voci: una scorciatoia che nessuno sa di
 * avere non è una scorciatoia, e l'unico posto che le elencava era
 * Impostazioni › Info, dove nessuno va a cercare la tastiera.
 */
export const TASTI: Record<string, { dove: string; cosa: string }> = {
  t: { dove: "/tasks", cosa: "Task" },
  /* «N» come «task Nuovo» portava direttamente alla creazione. Ora porta ai
     Task come T: è la coppia che si ricorda («T o N, i task»), ed è la
     richiesta arrivata dall'ufficio. La creazione rapida non si perde — si
     è spostata su C, che è anche la lettera giusta. */
  n: { dove: "/tasks", cosa: "Task" },
  p: { dove: "/projects", cosa: "Progetti" },
};

/** La lettera da mostrare accanto a una voce di navigazione, se c'è. */
export function tastoPer(href: string): string | null {
  for (const [tasto, meta] of Object.entries(TASTI)) {
    if (meta.dove === href) return tasto.toUpperCase();
  }
  return null;
}

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

      /* «C» come creare: apre un task nuovo ovunque ci si trovi, senza
         cambiare pagina. Passa dall'indirizzo, quindi funziona anche con il
         tasto indietro. Era su «N», che ora porta ai Task. */
      if (tasto === "c") {
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
