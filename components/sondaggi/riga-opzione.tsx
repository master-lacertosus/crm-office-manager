"use client";

import { motion, useReducedMotion } from "motion/react";

import { dur, ease } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import type { OpzioneSondaggio } from "@/lib/sondaggi";
import { cn } from "@/lib/utils";

/**
 * Una risposta possibile — e, dopo il voto, il suo risultato.
 *
 * È lo stesso nodo del DOM: votare non sostituisce la schermata con
 * un'altra, cambia mestiere alla riga che stavi guardando. La barra cresce
 * da sinistra dentro il riquadro che avevi appena premuto, e il testo non si
 * muove di un pixel. È l'unico momento «wow» del popup, ed è wow perché è
 * una sola cosa che si trasforma, non due che si scambiano di posto.
 *
 * La stessa riga serve tutti e tre i posti in cui un sondaggio compare: il
 * popup, la card «In corso» e l'archivio. Tre copie divergerebbero al primo
 * ritocco — su questo repo è già successo con l'ordinamento e con i filtri.
 */
export function RigaOpzione({
  opzione,
  totale,
  indice,
  votato,
  inTesta,
  scelta,
  disabilitata,
  onScegli,
  nomeGruppo,
}: {
  opzione: OpzioneSondaggio;
  totale: number;
  indice: number;
  /** Ho già votato: la riga mostra il risultato invece di chiedere. */
  votato: boolean;
  inTesta: boolean;
  scelta: boolean;
  disabilitata?: boolean;
  /** Assente = sola lettura (l'archivio, o un sondaggio chiuso). */
  onScegli?: (id: string) => void;
  nomeGruppo?: string;
}) {
  /* `useReducedMotion()` legge SOLO la media query di sistema. Ma questo
     prodotto ha anche un interruttore suo (Impostazioni › Aspetto), e chi
     l'ha acceso a mano si vedrebbe le barre correre lo stesso. */
  const { prefs } = usePreferences();
  const ridotto = useReducedMotion() || prefs.reduceMotion;

  const frazione = totale > 0 ? opzione.voti / totale : 0;
  const percento = Math.round(frazione * 100);

  const corpo = (
    <>
      {votato ? (
        <motion.span
          aria-hidden
          initial={ridotto ? false : { scaleX: 0 }}
          animate={{ scaleX: frazione }}
          transition={{
            duration: dur.slow,
            ease: ease.out,
            /* Sfalsate di 40ms e mai più di tre: è la regola del design
               system, e su sei righe uno scaglionamento più lungo diventa
               attesa invece che eleganza. */
            delay: Math.min(indice, 2) * 0.04,
          }}
          /* `transform`, mai `width`: è la regola, e la larghezza fa
             ricalcolare il layout a ogni fotogramma.
             E mai `bg-selected`: in tema chiaro è `--brand-50` #fff1e8 sopra
             una `.glass-chip` che va da bianco a #f7f9fc, cioè circa 1,03:1
             — una barra che cresce e che non si vede. L'arancio al 18% si
             compone bene in entrambi i temi, ed è la stessa ricetta
             `color-mix` del bottone `secondary`. */
          className="absolute inset-y-0 left-0 w-full origin-left bg-[color-mix(in_oklch,var(--brand-500),transparent_82%)]"
        />
      ) : null}
      {votato && inTesta ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-brand-500"
        />
      ) : null}

      <span
        aria-hidden
        className={cn(
          "gem relative z-10 size-3 shrink-0 rounded-full",
          scelta ? "bg-brand-500" : "bg-muted",
        )}
      />
      <span className="relative z-10 min-w-0 flex-1 text-sm text-ink">
        {opzione.testo}
        {votato && inTesta ? (
          /* Il colore non è mai l'unico canale: filo verticale più parola.
             «In testa» e non «più votata», perché `inTesta()` torna un
             ARRAY — fra sei persone un pareggio 2-2-2 è la norma, e
             incoronare la prima delle tre sarebbe una bugia decisa
             dall'ordine di inserimento. */
          <span className="ml-2 text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
            in testa
          </span>
        ) : null}
      </span>
      {votato ? (
        /* La percentuale grande e il numero di voti accanto, piccolo.
           Servono tutti e due e non sono ridondanti: fra sei persone «33%»
           dice la proporzione e «2» dice quante teste sono davvero — e con
           numeri così piccoli la seconda cosa è quella che si va a cercare.
           Prima si vedeva solo il conteggio, e la percentuale viveva nel
           testo per i lettori di schermo: cioè da nessuna parte, per tutti
           gli altri. */
        <span className="relative z-10 flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-[13px] font-bold tabular-nums text-ink">
            {percento}%
          </span>
          <span className="font-mono text-[11px] tabular-nums text-ink-muted">
            {opzione.voti}
          </span>
        </span>
      ) : null}
    </>
  );

  const classi =
    "glass-chip relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3.5 py-3 text-left";

  /* Dopo il voto NON è più un modulo, e non deve fingere di esserlo. Tenere
     i risultati dentro un `<fieldset disabled>` li farebbe leggere come una
     fila di scelte non disponibili; e un `role="progressbar"` dentro la
     `<label>` finirebbe nel nome della radio — «Caffè alle 15, in testa,
     Caffè alle 15: 3 di 6». Qui il risultato è testo, e il testo si legge. */
  if (votato || !onScegli) {
    return (
      <li className={classi}>
        {corpo}
        <span className="sr-only">
          {opzione.voti === 1 ? "1 voto" : `${opzione.voti} voti`} su {totale},{" "}
          {percento} per cento{inTesta ? ", in testa" : ""}
          {scelta ? ", è la tua risposta" : ""}
        </span>
      </li>
    );
  }

  return (
    <li>
      <label
        className={cn(
          classi,
          "hover-lift pressable cursor-pointer has-[:checked]:border-brand-500/45 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
        )}
      >
        {/* Radio nativo, nascosto ma vero: le frecce su e giù funzionano da
            sole, il lettore di schermo annuncia «2 di 4», e Invio manda il
            modulo. Rifarlo con dei `<div>` costerebbe tutte e tre le cose. */}
        <input
          type="radio"
          name={nomeGruppo}
          value={opzione.id}
          checked={scelta}
          disabled={disabilitata}
          onChange={() => onScegli(opzione.id)}
          className="sr-only"
        />
        {corpo}
      </label>
    </li>
  );
}
