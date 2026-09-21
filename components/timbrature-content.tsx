"use client";

import * as React from "react";
import { CalendarPlus, Trash2, TriangleAlert } from "lucide-react";

import { formatDue, giornoLocale } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import {
  giornateTra,
  inOre,
  minutiLavorati,
  minutiOltreOrario,
  ORARIO_UFFICIO,
  totaleMinuti,
  type Giornata,
} from "@/lib/timbrature";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toaster";

/* Nomi dei mesi, per il titolo. */
const MESE_FMT = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});
const GIORNO_FMT = new Intl.DateTimeFormat("it-IT", { weekday: "short" });

/** `2026-09-21T08:30:00Z` → `08:30`. */
function soloOra(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Da `08:45` scritto a mano al momento vero di quel giorno. */
function conNuovaOra(giorno: string, hhmm: string): string | null {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const [y, mo, d] = giorno.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
}

/** Il primo e l'ultimo giorno di un mese, come `YYYY-MM-DD`. */
function estremiDelMese(anno: number, mese: number): [string, string] {
  const primo = new Date(anno, mese, 1);
  const ultimo = new Date(anno, mese + 1, 0);
  return [giornoLocale(primo.toISOString()), giornoLocale(ultimo.toISOString())];
}

/** Un campo orario che salva quando lo si lascia. */
function CampoOra({
  valore,
  onCambia,
  etichetta,
}: {
  valore: string;
  onCambia: (hhmm: string) => void;
  etichetta: string;
}) {
  return (
    <input
      type="time"
      defaultValue={valore}
      aria-label={etichetta}
      onBlur={(e) => {
        if (e.target.value && e.target.value !== valore) onCambia(e.target.value);
      }}
      className="h-8 w-[5.5rem] rounded-lg border border-input bg-card px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

/**
 * Le proprie ore, mese per mese.
 *
 * Esiste per una ragione precisa, detta dall'ufficio: «il tempo che si accende
 * il pc, si apre, eccetera — la timbratura di inizio sarà falsata». È vero, e
 * non è un difetto da correggere nel codice: è la realtà di come si arriva al
 * lavoro. Quindi ogni orario qui è scrivibile, senza chiedere il permesso a
 * nessuno e senza aprire una pratica.
 *
 * Le correzioni lasciano un segno («corretta»), perché un quaderno che non
 * ricorda di essere stato riscritto è un quaderno di cui non ci si fida. Ma
 * non c'è approvazione e non c'è blocco: queste sono le tue ore, e le vedi
 * solo tu — nemmeno un responsabile.
 */
export function TimbratureContent() {
  const { timbrature, correggiGiornata, aggiungiGiornata, eliminaGiornata } =
    useAppStore();
  const toast = useToast();
  const adesso = new Date();
  const oggi = giornoLocale(adesso.toISOString());

  const [cursore, setCursore] = React.useState({
    anno: adesso.getFullYear(),
    mese: adesso.getMonth(),
  });
  const [aggiunge, setAggiunge] = React.useState(false);
  const [nuovoGiorno, setNuovoGiorno] = React.useState(oggi);
  const [nuovoDalle, setNuovoDalle] = React.useState("09:00");
  const [nuovoAlle, setNuovoAlle] = React.useState("18:00");
  const [daEliminare, setDaEliminare] = React.useState<string | null>(null);

  const [primo, ultimo] = estremiDelMese(cursore.anno, cursore.mese);
  const delMese = giornateTra(timbrature, primo, ultimo);
  const minutiMese = totaleMinuti(delMese, adesso);
  const oltreMese = delMese.reduce(
    (s, g) => s + minutiOltreOrario(g, adesso),
    0,
  );

  const titoloMese = MESE_FMT.format(new Date(cursore.anno, cursore.mese, 1));
  const spostaMese = (delta: -1 | 1) =>
    setCursore(({ anno, mese }) => {
      const d = new Date(anno, mese + delta, 1);
      return { anno: d.getFullYear(), mese: d.getMonth() };
    });

  const salvaNuova = async () => {
    const dalle = conNuovaOra(nuovoGiorno, nuovoDalle);
    const alle = nuovoAlle ? conNuovaOra(nuovoGiorno, nuovoAlle) : null;
    if (!dalle) return;
    const fatto = await aggiungiGiornata(nuovoGiorno, dalle, alle);
    if (!fatto) return;
    setAggiunge(false);
    toast(`Giornata del ${formatDue(nuovoGiorno)} aggiunta`);
  };

  const Riga = ({ g }: { g: Giornata }) => {
    const lavorati = minutiLavorati(g, adesso);
    const oltre = minutiOltreOrario(g, adesso);
    const aperta = !g.uscita;
    return (
      <tr className={cn("border-t border-border-soft", aperta && "bg-brand-50/40")}>
        <td className="py-2 pr-2 whitespace-nowrap">
          <span className="text-[13px] font-medium text-ink">
            {formatDue(g.giorno)}
          </span>
          <span className="ml-1.5 text-[11px] text-ink-muted">
            {GIORNO_FMT.format(new Date(`${g.giorno}T12:00:00`))}
          </span>
        </td>
        <td className="py-2 pr-2">
          <CampoOra
            valore={soloOra(g.entrata)}
            etichetta={`Entrata del ${g.giorno}`}
            onCambia={(hhmm) => {
              const iso = conNuovaOra(g.giorno, hhmm);
              if (iso) void correggiGiornata(g.id, { entrata: iso });
            }}
          />
        </td>
        <td className="py-2 pr-2">
          {aperta ? (
            <span className="text-[12px] font-semibold text-brand-700">
              in corso
            </span>
          ) : (
            <CampoOra
              valore={soloOra(g.uscita as string)}
              etichetta={`Uscita del ${g.giorno}`}
              onCambia={(hhmm) => {
                const iso = conNuovaOra(g.giorno, hhmm);
                if (iso) void correggiGiornata(g.id, { uscita: iso });
              }}
            />
          )}
        </td>
        <td className="py-2 pr-2">
          <input
            type="number"
            min={0}
            max={480}
            step={15}
            defaultValue={g.pausa_minuti}
            aria-label={`Pausa del ${g.giorno} in minuti`}
            onBlur={(e) => {
              const min = Number(e.target.value);
              if (Number.isFinite(min) && min !== g.pausa_minuti) {
                void correggiGiornata(g.id, { pausa_minuti: min });
              }
            }}
            className="h-8 w-16 rounded-lg border border-input bg-card px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </td>
        <td className="py-2 pr-2 text-right font-semibold whitespace-nowrap text-ink">
          {inOre(lavorati)}
        </td>
        <td className="py-2 pr-2 text-right whitespace-nowrap">
          {oltre > 0 ? (
            <span className="rounded-full bg-status-review-soft px-1.5 py-0.5 text-[11px] font-bold text-status-review-text">
              +{inOre(oltre)}
            </span>
          ) : (
            <span className="text-[12px] text-ink-faint">—</span>
          )}
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          {g.corretta_at ? (
            <span
              title="Gli orari di questa giornata sono stati scritti a mano"
              className="mr-1.5 text-[11px] text-ink-faint"
            >
              corretta
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (daEliminare === g.id) {
                void eliminaGiornata(g.id);
                setDaEliminare(null);
              } else {
                setDaEliminare(g.id);
              }
            }}
            aria-label={
              daEliminare === g.id
                ? `Conferma: elimina la giornata del ${g.giorno}`
                : `Elimina la giornata del ${g.giorno}`
            }
            className={cn(
              "rounded-lg p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              daEliminare === g.id
                ? "bg-danger-soft text-danger-text"
                : "text-ink-faint hover:bg-danger-soft/60 hover:text-danger-text",
            )}
          >
            {daEliminare === g.id ? (
              <TriangleAlert className="size-3.5" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* --- Il mese, e i due numeri che lo riassumono --- */}
      <section className="card-soft p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => spostaMese(-1)}
              aria-label="Mese precedente"
            >
              ‹
            </Button>
            <span className="min-w-40 text-center text-[15px] font-bold text-ink capitalize">
              {titoloMese}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => spostaMese(1)}
              aria-label="Mese successivo"
            >
              ›
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <div>
              <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                Ore del mese
              </p>
              <p className="text-[22px]/7 font-bold tracking-[-0.015em] text-ink">
                {minutiMese > 0 ? inOre(minutiMese) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                Giornate
              </p>
              <p className="text-[22px]/7 font-bold tracking-[-0.015em] text-ink">
                {delMese.length || "—"}
              </p>
            </div>
            {oltreMese > 0 ? (
              <div>
                <p className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                  Oltre l&rsquo;orario
                </p>
                <p className="text-[22px]/7 font-bold tracking-[-0.015em] text-status-review-text">
                  {inOre(oltreMese)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* --- Le giornate --- */}
      <section className="card-soft overflow-hidden">
        {delMese.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-ink-muted">
            Nessuna giornata timbrata in {titoloMese}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] px-4 text-left">
              <thead>
                <tr className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                  <th className="px-4 py-2 font-bold">Giorno</th>
                  <th className="py-2 pr-2 font-bold">Entrata</th>
                  <th className="py-2 pr-2 font-bold">Uscita</th>
                  <th className="py-2 pr-2 font-bold">Pausa</th>
                  <th className="py-2 pr-2 text-right font-bold">Ore</th>
                  <th className="py-2 pr-2 text-right font-bold">Oltre</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4">
                {delMese.map((g) => (
                  <Riga key={g.id} g={g} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Scrivere una giornata dimenticata --- */}
      <section className="card-soft p-4">
        {aggiunge ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[12px] text-ink-muted">
              Giorno
              <input
                type="date"
                value={nuovoGiorno}
                max={oggi}
                onChange={(e) => setNuovoGiorno(e.target.value)}
                className="mt-0.5 block h-8 rounded-lg border border-input bg-card px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="text-[12px] text-ink-muted">
              Dalle
              <input
                type="time"
                value={nuovoDalle}
                onChange={(e) => setNuovoDalle(e.target.value)}
                className="mt-0.5 block h-8 rounded-lg border border-input bg-card px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="text-[12px] text-ink-muted">
              Alle
              <input
                type="time"
                value={nuovoAlle}
                onChange={(e) => setNuovoAlle(e.target.value)}
                className="mt-0.5 block h-8 rounded-lg border border-input bg-card px-2 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button size="sm" onClick={salvaNuova}>
              Aggiungi
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAggiunge(false)}
            >
              Annulla
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAggiunge(true)}>
            <CalendarPlus data-icon="inline-start" />
            Aggiungi una giornata dimenticata
          </Button>
        )}
        <p className="mt-3 text-[12px] text-ink-muted">
          Si tolgono {ORARIO_UFFICIO.pausaMinuti} minuti di pausa per giornata,
          salvo quando esci e rientri: in quel caso vale il tempo che sei stato
          fuori davvero. Ogni orario è correggibile — il computer che si accende
          non è l&rsquo;ora in cui hai iniziato. Queste ore le vedi solo tu:
          nemmeno un responsabile può leggerle.
        </p>
      </section>
    </div>
  );
}
