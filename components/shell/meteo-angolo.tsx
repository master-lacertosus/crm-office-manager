"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import type { Meteo } from "@/lib/meteo";
import { pop } from "@/lib/motion";

/**
 * Il tempo a Parma, in un angolo.
 *
 * Due tentativi prima di questo, e vale la pena lasciarli scritti.
 *
 * Il primo era un blocco della dashboard: un riquadro grande con la striscia
 * delle ore, accanto a cose che parlano di lavoro. Troppo — il tempo che fa
 * non è lavoro, e messo lì chiedeva la stessa attenzione di una scadenza.
 *
 * Il secondo era una riga nella barra in alto. Meglio, ma quella barra ha già
 * ricerca, timbratura, scadenze e campanella: aggiungere una cosa che non
 * chiede nessun gesto la rendeva solo più affollata.
 *
 * Questo è il terzo: un'icona sola, in basso a destra, dove non c'è niente
 * che compete con lei. Si guarda se si vuole, si apre se serve, e per il
 * resto del tempo sta lì senza chiedere niente a nessuno — che è esattamente
 * il peso che deve avere una notizia sul meteo dentro un gestionale.
 */
export function MeteoAngolo() {
  const [meteo, setMeteo] = React.useState<Meteo | null>(null);
  const [aperto, setAperto] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/meteo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ko"))))
      .then((d: Meteo) => vivo && setMeteo(d))
      .catch(() => {
        /* Il meteo non è un dato critico: se il servizio è giù, l'icona non
           compare e nessuno se ne accorge. Meglio di un punto esclamativo
           che chiede attenzione per una cosa che non la merita. */
      });
    return () => {
      vivo = false;
    };
  }, []);

  React.useEffect(() => {
    if (!aperto) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setAperto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAperto(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [aperto]);

  if (!meteo) return null;

  const { adesso, prossime } = meteo;
  const frase = `Oggi su Parma il tempo è ${adesso.descrizione.toLocaleLowerCase("it")}, ${adesso.gradi}°`;

  return (
    /* `z-40`: sotto i messaggi del toaster (z-60), che abitano lo stesso
       angolo. Un messaggio dura tre secondi e ha sempre più diritto di
       farsi leggere; il meteo aspetta. */
    <div
      ref={rootRef}
      className="fixed right-4 bottom-4 z-40 print:hidden"
    >
      <AnimatePresence>
        {aperto ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Meteo a Parma"
            className="glass-strong absolute right-0 bottom-12 w-[260px] origin-bottom-right rounded-xl p-3"
          >
            <p className="flex items-baseline gap-2">
              <span aria-hidden className="text-[22px] leading-none">
                {adesso.simbolo}
              </span>
              <span className="text-[24px]/7 font-bold tracking-[-0.02em] text-ink">
                {adesso.gradi}°
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              {adesso.descrizione} a Parma
              {adesso.vento > 0 ? (
                <span className="text-ink-muted">
                  {" "}
                  · vento {adesso.vento} km/h
                </span>
              ) : null}
            </p>

            {prossime.length > 0 ? (
              <ul className="mt-2.5 flex justify-between gap-1 border-t border-border-soft pt-2.5">
                {prossime.slice(0, 5).map((o) => (
                  <li key={o.ora} className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[10px] text-ink-muted">
                      {o.ora}
                    </span>
                    <span aria-hidden className="text-[13px] leading-none">
                      {o.simbolo}
                    </span>
                    <span className="text-[11px] font-semibold text-ink-secondary">
                      {o.gradi}°
                    </span>
                    {/* La pioggia si scrive solo quando c'è: una riga di zeri
                        sotto ogni ora nasconderebbe l'unico numero che conta
                        il giorno in cui compare. */}
                    {o.pioggia > 0 ? (
                      <span className="font-mono text-[9px] text-status-review-text">
                        {o.pioggia.toFixed(1)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        aria-label={frase}
        title={frase}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-[17px] leading-none shadow-sm outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <span aria-hidden>{adesso.simbolo}</span>
      </button>
    </div>
  );
}
