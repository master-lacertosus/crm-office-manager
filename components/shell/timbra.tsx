"use client";

import * as React from "react";
import { LogIn, LogOut } from "lucide-react";

import {
  giornataAperta,
  inOre,
  minutiLavorati,
} from "@/lib/timbrature";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Timbrare, da qualunque schermata.
 *
 * Sta nella barra superiore e non in un blocco della dashboard perché è un
 * gesto, non un'informazione: si fa due volte al giorno, arrivando e
 * andando via, e in quei due momenti non si è per forza sulla dashboard.
 * È lo stesso posto e la stessa natura di `DeadlineIndicator`, che pure è
 * insieme stato e comando.
 *
 * Mostra i minuti fatti finora, non l'orologio: «3h 12m» dice qualcosa,
 * «10:42» lo dice già il computer in fondo allo schermo.
 */
export function Timbra() {
  const { timbrature, timbraEntrata, timbraUscita } = useAppStore();
  const [inCorso, setInCorso] = React.useState(false);

  /* Il tempo trascorso si conta solo nel browser.
     Disegnando «3h 12m» anche sul server, server e browser produrrebbero due
     stringhe diverse e l'idratazione fallirebbe: è la stessa trappola che
     questo progetto ha già incontrato con la modalità Zen e con la memoria
     dei filtri. `useSyncExternalStore` è l'attrezzo giusto — la terza
     istantanea è la risposta del server, dove un cronometro non esiste. */
  const adesso = React.useSyncExternalStore(
    React.useCallback((avvisa: () => void) => {
      /* Ogni trenta secondi: il numero cambia al minuto, e aspettare fino a
         un minuto per vederlo scattare sarebbe percepito come fermo. */
      const t = setInterval(avvisa, 30_000);
      return () => clearInterval(t);
    }, []),
    () => Math.floor(Date.now() / 30_000),
    () => 0,
  );

  const aperta = giornataAperta(timbrature);
  /* `adesso` non si usa per il valore ma per il momento: serve a far
     ridisegnare il componente. Il tempo vero si legge qui. */
  void adesso;
  const minuti = aperta ? minutiLavorati(aperta, new Date()) : 0;

  const premi = async () => {
    if (inCorso) return;
    setInCorso(true);
    try {
      if (aperta) await timbraUscita();
      else await timbraEntrata();
    } finally {
      setInCorso(false);
    }
  };

  return (
    <button
      type="button"
      onClick={premi}
      disabled={inCorso}
      aria-label={
        aperta
          ? `Stai lavorando da ${inOre(minuti)} — premi per timbrare l'uscita`
          : "Timbra l'entrata"
      }
      title={
        aperta
          ? "Timbra l'uscita"
          : "Timbra l'entrata"
      }
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50",
        aperta
          ? "bg-status-done-soft text-status-done-text"
          : "border border-border bg-card text-ink-secondary hover:text-ink",
      )}
    >
      {aperta ? (
        <>
          {/* Il pallino dice «stai correndo» senza aggiungere parole. */}
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-current"
          />
          {inOre(minuti)}
          <LogOut aria-hidden className="size-3.5" />
        </>
      ) : (
        <>
          <LogIn aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Timbra</span>
        </>
      )}
    </button>
  );
}
