"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Sparkline } from "@/components/charts/sparkline";
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
  type Giornata,
} from "@/lib/timbrature";
import { cn } from "@/lib/utils";

const GIORNATA_MINUTI = 8 * 60;
const INIZIALI = ["L", "M", "M", "G", "V", "S", "D"];

/**
 * La giornata di oggi, con quanto manca alle otto ore.
 *
 * La barra ha un solo riferimento — la giornata piena — ed è l'unico che
 * questo prodotto può permettersi: è aritmetica su un giorno, non un monte
 * ore dovuto. Una barra «su 40 ore» sarebbe una promessa falsa finché i
 * festivi infrasettimanali non esistono e un permesso a ore è testo libero.
 */
function Oggi({ minuti, aperta }: { minuti: number; aperta: boolean }) {
  const quota = Math.min(1, minuti / GIORNATA_MINUTI);
  const oltre = Math.max(0, minuti - GIORNATA_MINUTI);
  const manca = Math.max(0, GIORNATA_MINUTI - minuti);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
          Oggi
        </p>
        {aperta ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
            in corso
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[28px]/9 font-bold tracking-[-0.02em] tabular-nums text-ink">
        {minuti > 0 ? inOre(minuti) : "—"}
      </p>
      <div
        className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-border-soft"
        role="img"
        aria-label={
          minuti === 0
            ? "Nessuna ora oggi"
            : oltre > 0
              ? `${inOre(minuti)} oggi, ${inOre(oltre)} oltre le otto ore`
              : `${inOre(minuti)} oggi, ${inOre(manca)} alle otto ore`
        }
      >
        <span
          className="h-full rounded-full bg-ink-secondary transition-[width] duration-500"
          style={{ width: `${quota * 100}%` }}
        />
        {oltre > 0 ? (
          <span
            className="h-full rounded-full bg-warning"
            style={{
              width: `${Math.min(35, (oltre / GIORNATA_MINUTI) * 100)}%`,
            }}
          />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        {minuti === 0
          ? `Giornata piena: ${inOre(GIORNATA_MINUTI)}`
          : oltre > 0
            ? `${inOre(oltre)} oltre le otto ore`
            : `${inOre(manca)} alla giornata piena`}
      </p>
    </div>
  );
}

/** La settimana come sette colonnine: la forma, non sette numeri. */
function Settimana({
  minutiPerGiorno,
  totale,
}: {
  minutiPerGiorno: number[];
  totale: number;
}) {
  const tetto = Math.max(GIORNATA_MINUTI, ...minutiPerGiorno);
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
        Settimana
      </p>
      <p className="mt-0.5 text-[18px]/6 font-bold tracking-[-0.015em] tabular-nums text-ink">
        {totale > 0 ? inOre(totale) : "—"}
      </p>
      <div className="mt-1.5 flex h-7 items-end gap-1">
        {minutiPerGiorno.map((m, i) => (
          <span
            key={INIZIALI[i] + i}
            title={`${INIZIALI[i]}: ${m > 0 ? inOre(m) : "niente"}`}
            className="flex-1 rounded-sm bg-ink-secondary"
            style={{
              height: `${Math.max(2, (m / tetto) * 100)}%`,
              opacity: m === 0 ? 0.18 : i > 4 ? 0.55 : 1,
            }}
          />
        ))}
      </div>
      <p aria-hidden className="mt-0.5 flex gap-1 text-[9px] text-ink-faint">
        {INIZIALI.map((l, i) => (
          <span key={l + i} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Le proprie ore: oggi, questa settimana, questo mese.
 *
 * Non c'è un «dovuto» e non c'è un saldo, e non è una dimenticanza: quel
 * numero sarebbe falso finché il prodotto non conosce i festivi
 * infrasettimanali e non sa contare un permesso a ore — e un numero falso
 * messo in grande è peggio di un numero assente.
 *
 * Tre numeri nudi però sono un tabellone, non un quadro: adesso ognuno porta
 * la propria forma accanto (quanto manca a oggi, la sagoma della settimana,
 * l'andamento del mese), che è l'informazione che un numero da solo non dà.
 * Il mese intero, giorno per giorno, sta in «Le mie ore» — il link in fondo.
 *
 * Nessuno vede queste righe tranne chi le ha fatte: lo impone la RLS, non
 * questo componente.
 */
export function BloccoOre({ onNaviga }: { onNaviga?: () => void } = {}) {
  const { timbrature, correggiGiornata } = useAppStore();
  const [apertaId, setApertaId] = React.useState<string | null>(null);

  const adesso = new Date();
  const oggi = giornoLocale(adesso.toISOString());

  const diOggi = giornataDiOggi(timbrature, adesso);
  const lunedi = lunediDi(oggi);
  const settimana = giornateTra(timbrature, lunedi, oggi);
  const mese = giornateTra(timbrature, primoDelMeseDi(oggi), oggi);
  const ultime = giornateTra(timbrature, "0000-01-01", oggi).slice(0, 5);

  /* Sette caselle lunedì→domenica, non «le giornate timbrate»: un mercoledì
     vuoto in mezzo alla settimana è un'informazione, e una lista compattata
     lo nasconderebbe. */
  const perGiorno = new Map(settimana.map((g) => [g.giorno, g]));
  const settimanaMinuti = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = lunedi.split("-").map(Number);
    const giorno = giornoLocale(new Date(y, m - 1, d + i).toISOString());
    const g = perGiorno.get(giorno);
    return g ? minutiLavorati(g, adesso) : 0;
  });

  const minutiMese = totaleMinuti(mese, adesso);
  const andamentoMese = [...mese]
    .reverse()
    .map((g) => minutiLavorati(g, adesso));

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
      <Oggi
        minuti={diOggi ? minutiLavorati(diOggi, adesso) : 0}
        aperta={Boolean(diOggi && !diOggi.uscita)}
      />

      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border-soft pt-3">
        <Settimana
          minutiPerGiorno={settimanaMinuti}
          totale={totaleMinuti(settimana, adesso)}
        />
        <div className="flex flex-col">
          <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
            Mese
          </p>
          <p className="mt-0.5 text-[18px]/6 font-bold tracking-[-0.015em] tabular-nums text-ink">
            {minutiMese > 0 ? inOre(minutiMese) : "—"}
          </p>
          {andamentoMese.length > 1 ? (
            <div className="mt-auto pt-1.5">
              <Sparkline
                values={andamentoMese}
                color="#64748b"
                ariaLabel="Andamento delle ore del mese"
                className="h-9 w-full"
              />
            </div>
          ) : (
            <p className="mt-auto pt-1.5 text-[11px] text-ink-faint">
              {mese.length === 1
                ? "una sola giornata finora"
                : "niente questo mese"}
            </p>
          )}
        </div>
      </div>

      {ultime.length === 0 ? (
        <p className="mt-3 border-t border-border-soft pt-3 text-[13px] text-ink-muted">
          Non hai ancora timbrato. Il pulsante sta in alto, accanto alla
          campanella.
        </p>
      ) : (
        <ul className="mt-3 space-y-0.5 border-t border-border-soft pt-2">
          {ultime.map((g) => (
            <RigaRecente
              key={g.id}
              g={g}
              oggi={oggi}
              adesso={adesso}
              aperto={apertaId === g.id}
              onApri={() => setApertaId(apertaId === g.id ? null : g.id)}
              soloOra={soloOra}
              conNuovaOra={conNuovaOra}
              onCorreggi={(patch) => void correggiGiornata(g.id, patch)}
            />
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-faint">
          Si tolgono {ORARIO_UFFICIO.pausaMinuti} minuti di pausa per giornata.
          Conteggio orientativo, solo per te.
        </p>
        <Link
          href="/timbrature"
          onClick={onNaviga}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1 py-0.5 text-[12px] font-semibold text-ink-secondary outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tutto il mese
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** Una delle ultime cinque giornate, che si apre per una correzione al volo.
 *  Fuori dal blocco: un componente definito dentro un altro viene ricreato a
 *  ogni disegno, e React lo smonta invece di aggiornarlo. */
function RigaRecente({
  g,
  oggi,
  adesso,
  aperto,
  onApri,
  soloOra,
  conNuovaOra,
  onCorreggi,
}: {
  g: Giornata;
  oggi: string;
  adesso: Date;
  aperto: boolean;
  onApri: () => void;
  soloOra: (iso: string) => string;
  conNuovaOra: (giorno: string, hhmm: string) => string | null;
  onCorreggi: (patch: {
    entrata?: string;
    uscita?: string | null;
    pausa_minuti?: number;
  }) => void;
}) {
  const oltre = minutiOltreOrario(g, adesso);

  return (
    <li>
      <button
        type="button"
        onClick={onApri}
        aria-expanded={aperto}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring",
          aperto && "bg-accent/70",
        )}
      >
        <span className="w-14 shrink-0 text-[12px] text-ink-muted">
          {g.giorno === oggi ? "Oggi" : formatDue(g.giorno)}
        </span>
        <span className="min-w-0 flex-1 font-mono text-[12px] tabular-nums text-ink-secondary">
          {soloOra(g.entrata)}
          {g.uscita ? `–${soloOra(g.uscita)}` : "–…"}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
          {inOre(minutiLavorati(g, adesso))}
        </span>
        {/* «Oltre l'orario», non «straordinario»: è una differenza aritmetica
            su una giornata, non un istituto contrattuale, e chiamarla così
            sarebbe un'affermazione che questo strumento non può sostenere.
            L'ambra è la stessa del grafico: una cosa sola, detta due volte. */}
        {oltre > 0 ? (
          <span
            title={`${inOre(oltre)} oltre le 8 ore`}
            className="shrink-0 rounded-full bg-warning-soft px-1.5 font-mono text-[10px] font-bold tabular-nums text-warning-text"
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
                if (iso && iso !== g.entrata) onCorreggi({ entrata: iso });
              }}
              className="h-7 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  if (iso && iso !== g.uscita) onCorreggi({ uscita: iso });
                }}
                className="h-7 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  onCorreggi({ pausa_minuti: min });
                }
              }}
              className="h-7 w-16 rounded-lg border border-input bg-card px-1.5 font-mono text-[12px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            min
          </label>
          {g.corretta_at ? (
            <span className="text-[11px] text-ink-faint">corretta a mano</span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
