"use client";

import * as React from "react";
import { CloudOff } from "lucide-react";

import type { Meteo } from "@/lib/meteo";

/**
 * Il tempo a Parma, dove sta l'ufficio.
 *
 * Nessun avviso, di proposito. «Avvisami quando cambia il tempo» suona utile
 * finché non ci si chiede quale decisione cambierebbe: i lavori qui dentro
 * non hanno un luogo, quindi nessun avviso saprebbe a chi è diretto, e un
 * avviso per tutti è un avviso per nessuno — cioè quello che si impara a
 * ignorare, insieme a quelli veri accanto. Se salterà fuori un caso concreto
 * (uno shooting all'aperto, una consegna), l'avviso si costruisce attorno a
 * quello e vive dentro questo blocco: mai nella campanella, mai un toast.
 */
export function BloccoMeteo() {
  const [meteo, setMeteo] = React.useState<Meteo | null>(null);
  const [errore, setErrore] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/meteo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ko"))))
      .then((d: Meteo) => vivo && setMeteo(d))
      .catch(() => vivo && setErrore(true));
    return () => {
      vivo = false;
    };
  }, []);

  if (errore) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <CloudOff aria-hidden className="size-4 shrink-0" />
        Meteo non disponibile in questo momento.
      </p>
    );
  }

  if (!meteo) {
    /* Uno scheletro della stessa altezza del contenuto vero: senza, il
       blocco cresce quando arriva la risposta e spinge giù quelli sotto. */
    return (
      <div className="animate-pulse space-y-3" aria-hidden>
        <div className="h-9 w-28 rounded-lg bg-velo" />
        <div className="h-10 rounded-lg bg-velo" />
      </div>
    );
  }

  const { adesso, prossime } = meteo;

  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span aria-hidden className="text-[28px] leading-none">
          {adesso.simbolo}
        </span>
        <span className="text-[30px]/9 font-bold tracking-[-0.02em] text-ink">
          {adesso.gradi}°
        </span>
      </p>
      <p className="mt-1 text-[13px] text-ink-secondary">
        {adesso.descrizione}
        {adesso.vento > 0 ? (
          <span className="text-ink-muted"> · vento {adesso.vento} km/h</span>
        ) : null}
      </p>

      {prossime.length > 0 ? (
        <ul className="mt-3 flex justify-between gap-1 border-t border-border-soft pt-3">
          {prossime.map((o) => (
            <li key={o.ora} className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-[11px] text-ink-muted">
                {o.ora}
              </span>
              <span aria-hidden className="text-[15px] leading-none">
                {o.simbolo}
              </span>
              <span className="text-[12px] font-semibold text-ink-secondary">
                {o.gradi}°
              </span>
              {/* La pioggia si scrive solo se c'è: una riga di zeri sotto
                  ogni ora sarebbe rumore che nasconde l'unico numero che
                  conta il giorno in cui compare. */}
              {o.pioggia > 0 ? (
                <span className="font-mono text-[10px] text-status-review-text">
                  {o.pioggia.toFixed(1)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
