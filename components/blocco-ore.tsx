"use client";

import * as React from "react";

import { formatDue, giornoLocale } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import {
  giornataDiOggi,
  giornateTra,
  inOre,
  lunediDi,
  minutiLavorati,
  minutiOltreOrario,
  ORARIO_UFFICIO,
  primoDelMeseDi,
  totaleMinuti,
} from "@/lib/timbrature";

/** Uno dei tre numeri in testa. Vive fuori dal blocco perché un componente
 *  definito dentro un altro viene ricreato a ogni disegno, e React lo tratta
 *  come un tipo nuovo: smonta e rimonta invece di aggiornare. */
function Numero({ etichetta, minuti }: { etichetta: string; minuti: number }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
        {etichetta}
      </p>
      <p className="mt-0.5 text-[22px]/7 font-bold tracking-[-0.015em] text-ink">
        {minuti > 0 ? inOre(minuti) : "—"}
      </p>
    </div>
  );
}

/**
 * Le proprie ore: oggi, questa settimana, questo mese.
 *
 * Tre numeri e le ultime giornate, correggibili. Non c'è un «dovuto» e non
 * c'è un saldo, e non è una dimenticanza: quel numero sarebbe falso finché
 * il prodotto non conosce i festivi infrasettimanali e non sa contare un
 * permesso a ore — e un numero falso messo in grande è peggio di un numero
 * assente. Qui si risponde alla domanda che è stata fatta, «com'è andato il
 * mese», e ci si ferma lì.
 *
 * Nessuno vede queste righe tranne chi le ha fatte: lo impone la RLS, non
 * questo componente.
 */
export function BloccoOre() {
  const { timbrature, correggiGiornata } = useAppStore();
  const [apertaId, setApertaId] = React.useState<string | null>(null);

  const adesso = new Date();
  const oggi = giornoLocale(adesso.toISOString());

  const diOggi = giornataDiOggi(timbrature, adesso);
  const settimana = giornateTra(timbrature, lunediDi(oggi), oggi);
  const mese = giornateTra(timbrature, primoDelMeseDi(oggi), oggi);
  const ultime = giornateTra(timbrature, "0000-01-01", oggi).slice(0, 5);

  /** `2026-09-21T08:30:00Z` → `08:30`, per il campo orario. */
  const soloOra = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  /** Da `08:45` scritto a mano al momento vero di quel giorno. */
  const conNuovaOra = (giorno: string, hhmm: string): string | null => {
    const [h, m] = hhmm.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const [y, mo, d] = giorno.split("-").map(Number);
    return new Date(y, mo - 1, d, h, m).toISOString();
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Numero
          etichetta="Oggi"
          minuti={diOggi ? minutiLavorati(diOggi, adesso) : 0}
        />
        <Numero etichetta="Settimana" minuti={totaleMinuti(settimana, adesso)} />
        <Numero etichetta="Mese" minuti={totaleMinuti(mese, adesso)} />
      </div>

      {ultime.length === 0 ? (
        <p className="mt-3 border-t border-border-soft pt-3 text-[13px] text-ink-muted">
          Non hai ancora timbrato. Il pulsante sta in alto, accanto alla
          campanella.
        </p>
      ) : (
        <ul className="mt-3 space-y-0.5 border-t border-border-soft pt-2">
          {ultime.map((g) => {
            const oltre = minutiOltreOrario(g, adesso);
            const aperto = apertaId === g.id;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setApertaId(aperto ? null : g.id)}
                  aria-expanded={aperto}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-14 shrink-0 text-[12px] text-ink-muted">
                    {g.giorno === oggi ? "Oggi" : formatDue(g.giorno)}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-[12px] text-ink-secondary">
                    {soloOra(g.entrata)}
                    {g.uscita ? `–${soloOra(g.uscita)}` : "–…"}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-ink">
                    {inOre(minutiLavorati(g, adesso))}
                  </span>
                  {/* «Oltre l'orario», non «straordinario»: è una differenza
                      aritmetica su una giornata, non un istituto
                      contrattuale, e chiamarla così sarebbe un'affermazione
                      che questo strumento non può sostenere. */}
                  {oltre > 0 ? (
                    <span
                      title={`${inOre(oltre)} oltre le 8 ore`}
                      className="shrink-0 rounded-full bg-status-review-soft px-1.5 text-[10px] font-bold text-status-review-text"
                    >
                      +{inOre(oltre)}
                    </span>
                  ) : null}
                </button>

                {aperto ? (
                  <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1 pb-2">
                    <label className="flex items-center gap-1 text-[12px] text-ink-muted">
                      Entrata
                      <input
                        type="time"
                        defaultValue={soloOra(g.entrata)}
                        onBlur={(e) => {
                          const iso = conNuovaOra(g.giorno, e.target.value);
                          if (iso && iso !== g.entrata) {
                            void correggiGiornata(g.id, { entrata: iso });
                          }
                        }}
                        className="h-7 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    {g.uscita ? (
                      <label className="flex items-center gap-1 text-[12px] text-ink-muted">
                        Uscita
                        <input
                          type="time"
                          defaultValue={soloOra(g.uscita)}
                          onBlur={(e) => {
                            const iso = conNuovaOra(g.giorno, e.target.value);
                            if (iso && iso !== g.uscita) {
                              void correggiGiornata(g.id, { uscita: iso });
                            }
                          }}
                          className="h-7 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                    ) : null}
                    <label className="flex items-center gap-1 text-[12px] text-ink-muted">
                      Pausa
                      <input
                        type="number"
                        min={0}
                        max={480}
                        step={15}
                        defaultValue={g.pausa_minuti}
                        onBlur={(e) => {
                          const min = Number(e.target.value);
                          if (Number.isFinite(min) && min !== g.pausa_minuti) {
                            void correggiGiornata(g.id, { pausa_minuti: min });
                          }
                        }}
                        className="h-7 w-16 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      min
                    </label>
                    {g.corretta_at ? (
                      <span className="text-[11px] text-ink-faint">
                        corretta a mano
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-ink-faint">
        Si tolgono {ORARIO_UFFICIO.pausaMinuti} minuti di pausa per giornata.
        Conteggio orientativo, solo per te.
      </p>
    </div>
  );
}
