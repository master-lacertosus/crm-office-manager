"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { apriRicerca } from "@/components/command-palette";

/**
 * Il campo «Cerca» della barra superiore.
 *
 * La ricerca globale esisteva già, ed è più completa di quanto chiunque
 * immagini: trova task aperti e chiusi, pezzi, progetti, persone, richieste,
 * ferie, e cerca anche DENTRO descrizioni, note, motivi di rifiuto e corpo
 * dei commenti. Solo che si apriva unicamente con Ctrl+K, e una funzione che
 * si raggiunge con una scorciatoia che nessuno ti ha detto è una funzione
 * che, per chi la usa, non esiste.
 *
 * Non è un campo di testo vero: è un pulsante che ne ha l'aspetto. Un input
 * qui costringerebbe a tenere due caselle sincronizzate — questa e quella del
 * pannello — per poi buttare via la prima al primo carattere. Meglio una
 * porta che sembra una porta.
 */
export function CercaTutto() {
  /* La scorciatoia si scrive giusta per la tastiera che si ha davanti: ⌘K su
     Mac, Ctrl K altrove.
     `useSyncExternalStore` e non uno stato con effetto: è l'attrezzo fatto
     apposta per un valore che il server non può conoscere. Il terzo
     argomento è la risposta durante il disegno sul server (niente Mac),
     il secondo quella nel browser; la sottoscrizione è vuota perché il
     sistema operativo non cambia mentre la pagina è aperta. */
  const mac = React.useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );

  return (
    <button
      type="button"
      onClick={apriRicerca}
      aria-label="Cerca in tutto il workspace"
      className="group/cerca inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card pr-1.5 pl-2.5 text-[13px] text-ink-muted outline-none transition-colors hover:border-border-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <Search aria-hidden className="size-3.5 shrink-0" />
      {/* Sotto i 1024px resta la sola lente: la barra ha già titolo, filtri e
          azioni, e su un portatile stretto la parola «Cerca» è la prima cosa
          che si può togliere senza perdere la funzione. */}
      <span className="hidden lg:inline">Cerca…</span>
      <kbd
        aria-hidden
        className="hidden rounded border border-border-soft px-1 font-mono text-[10px] leading-4 font-semibold text-ink-faint lg:inline-block"
      >
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
