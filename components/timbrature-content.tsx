"use client";

import * as React from "react";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock4,
  Hourglass,
  Sunrise,
  Trash2,
  TriangleAlert,
} from "lucide-react";

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
import { KpiIcon } from "@/components/charts/kpi-icon";
import {
  OreDelMese,
  type GiornoDelMese,
} from "@/components/charts/ore-del-mese";
import { Sparkline } from "@/components/charts/sparkline";
import { StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toaster";

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

/** Tutti i giorni di un mese, come `YYYY-MM-DD`. */
function giorniDelMese(anno: number, mese: number): string[] {
  const quanti = new Date(anno, mese + 1, 0).getDate();
  return Array.from({ length: quanti }, (_, i) =>
    giornoLocale(new Date(anno, mese, i + 1).toISOString()),
  );
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
      /* Il campo non sembra un campo finché non lo si tocca: una tabella di
         venti righe con venti riquadri bordati si legge come un modulo da
         compilare, e questa è una cosa da guardare. Il bordo compare al
         passaggio e al fuoco, dove serve. */
      className="h-8 w-[5.25rem] rounded-lg border border-transparent bg-transparent px-1.5 font-mono text-[13px] tabular-nums outline-none transition-colors hover:border-input hover:bg-card focus:border-input focus:bg-card focus-visible:ring-2 focus-visible:ring-ring"
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
 * L'impaginazione segue la domanda, non le tabelle: prima i quattro numeri che
 * rispondono a «com'è andato il mese», poi la forma del mese in un colpo
 * d'occhio, e solo alla fine il dettaglio giorno per giorno — che si guarda
 * quando si è già deciso che c'è qualcosa da sistemare.
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

  const tuttiIGiorni = giorniDelMese(cursore.anno, cursore.mese);
  const primo = tuttiIGiorni[0];
  const ultimo = tuttiIGiorni[tuttiIGiorni.length - 1];
  const delMese = giornateTra(timbrature, primo, ultimo);

  const perGiorno = new Map(delMese.map((g) => [g.giorno, g]));
  const colonne: GiornoDelMese[] = tuttiIGiorni.map((giorno, i) => {
    const dow = new Date(`${giorno}T12:00:00`).getDay();
    const g = perGiorno.get(giorno);
    return {
      giorno,
      numero: i + 1,
      minuti: g ? minutiLavorati(g, adesso) : 0,
      weekend: dow === 0 || dow === 6,
      oggi: giorno === oggi,
    };
  });

  const minutiMese = totaleMinuti(delMese, adesso);
  const oltreMese = delMese.reduce(
    (s, g) => s + minutiOltreOrario(g, adesso),
    0,
  );
  const mediaMinuti = delMese.length > 0 ? minutiMese / delMese.length : 0;

  /* La sparkline segue i giorni in cui si è lavorato, in ordine: i vuoti
     porterebbero la linea a zero e disegnerebbero una sega che non racconta
     niente. */
  const andamento = [...delMese]
    .reverse()
    .map((g) => minutiLavorati(g, adesso));

  const titoloMese = MESE_FMT.format(new Date(cursore.anno, cursore.mese, 1));
  const meseCorrente =
    cursore.anno === adesso.getFullYear() && cursore.mese === adesso.getMonth();
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

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {/* --- Il mese che si sta guardando --- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => spostaMese(-1)}
            aria-label="Mese precedente"
            className="rounded-full"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center text-[13px] font-bold text-ink capitalize">
            {titoloMese}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => spostaMese(1)}
            disabled={meseCorrente}
            aria-label="Mese successivo"
            className="rounded-full"
          >
            <ChevronRight />
          </Button>
        </div>
        {!meseCorrente ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCursore({
                anno: adesso.getFullYear(),
                mese: adesso.getMonth(),
              })
            }
          >
            Torna a questo mese
          </Button>
        ) : null}
      </div>

      {/* --- I quattro numeri che rispondono a «com'è andato» --- */}
      <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Ore del mese"
          value={minutiMese / 60}
          decimals={1}
          sublabel={inOre(minutiMese)}
          aurora="rgb(255 107 0 / 0.10)"
          className="h-full"
          icon={
            <KpiIcon
              icon={Clock4}
              className="bg-brand-50 text-status-review-text"
            />
          }
        >
          {andamento.length > 1 ? (
            <Sparkline
              values={andamento}
              color="#3E434B"
              ariaLabel={`Andamento delle ore in ${titoloMese}`}
            />
          ) : null}
        </StatTile>

        <StatTile
          label="Media al giorno"
          value={mediaMinuti / 60}
          decimals={1}
          sublabel={
            delMese.length > 0
              ? `su ${delMese.length} giornat${delMese.length === 1 ? "a" : "e"}`
              : "nessuna giornata"
          }
          aurora="rgb(59 130 246 / 0.10)"
          className="h-full"
          icon={
            <KpiIcon
              icon={Sunrise}
              className="bg-status-todo-soft text-status-todo-text"
            />
          }
        />

        <StatTile
          label="Giornate timbrate"
          value={delMese.length}
          sublabel={
            meseCorrente ? "mese in corso" : `in ${titoloMese.split(" ")[0]}`
          }
          aurora="rgb(22 163 101 / 0.11)"
          className="h-full"
          icon={
            <KpiIcon
              icon={CalendarCheck}
              className="bg-status-done-soft text-status-done-text"
            />
          }
        />

        <StatTile
          label="Oltre l'orario"
          value={oltreMese / 60}
          decimals={1}
          sublabel={oltreMese > 0 ? inOre(oltreMese) : "nessuna"}
          aurora="rgb(245 158 11 / 0.12)"
          className="h-full"
          icon={
            <KpiIcon
              icon={Hourglass}
              className="bg-warning-soft text-warning-text"
            />
          }
        />
      </div>

      {/* --- La forma del mese --- */}
      <section className="card-soft p-4">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
            Giorno per giorno
          </h2>
          <p className="text-[12px] text-ink-muted">
            Si tolgono {ORARIO_UFFICIO.pausaMinuti} minuti di pausa, salvo
            quando esci e rientri: in quel caso vale il tempo che sei stato
            fuori davvero.
          </p>
        </header>
        <OreDelMese giorni={colonne} />
      </section>

      {/* --- Il dettaglio, per chi ha qualcosa da sistemare --- */}
      <section className="card-soft overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h2 className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
            Le giornate
          </h2>
          {aggiunge ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAggiunge(true)}
            >
              <CalendarPlus data-icon="inline-start" />
              Aggiungi una giornata
            </Button>
          )}
        </header>

        {aggiunge ? (
          <div className="mx-4 mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border bg-velo/50 p-3">
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
                className="mt-0.5 block h-8 rounded-lg border border-input bg-card px-2 font-mono text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="text-[12px] text-ink-muted">
              Alle
              <input
                type="time"
                value={nuovoAlle}
                onChange={(e) => setNuovoAlle(e.target.value)}
                className="mt-0.5 block h-8 rounded-lg border border-input bg-card px-2 font-mono text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button size="sm" onClick={salvaNuova}>
              Aggiungi
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAggiunge(false)}>
              Annulla
            </Button>
          </div>
        ) : null}

        {delMese.length === 0 ? (
          <p className="px-4 pt-2 pb-6 text-[13px] text-ink-muted">
            Nessuna giornata timbrata in {titoloMese}. Il pulsante per timbrare
            sta in alto, accanto alla campanella.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left">
              <thead>
                <tr className="border-b border-border-soft text-[10px] font-bold tracking-[0.06em] text-ink-muted uppercase">
                  <th className="py-2 pl-4 font-bold">Giorno</th>
                  <th className="py-2 font-bold">Entrata</th>
                  <th className="py-2 font-bold">Uscita</th>
                  <th className="py-2 font-bold">Pausa</th>
                  <th className="py-2 pr-2 text-right font-bold">Ore</th>
                  <th className="py-2 pr-4 text-right font-bold">Oltre</th>
                  <th className="w-10 py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {delMese.map((g) => (
                  <RigaGiornata
                    key={g.id}
                    g={g}
                    oggi={oggi}
                    adesso={adesso}
                    armata={daEliminare === g.id}
                    onArma={() =>
                      setDaEliminare(daEliminare === g.id ? null : g.id)
                    }
                    onElimina={() => {
                      void eliminaGiornata(g.id);
                      setDaEliminare(null);
                    }}
                    onCorreggi={(patch) => void correggiGiornata(g.id, patch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-border-soft px-4 py-3 text-[12px] text-ink-muted">
          Ogni orario è correggibile: il computer che si accende non è l&rsquo;ora
          in cui hai iniziato. Queste ore le vedi solo tu, nemmeno un
          responsabile.
        </p>
      </section>
    </div>
  );
}

/** Una giornata nella tabella. Fuori dal componente padre: definirla dentro
 *  la ricreerebbe a ogni disegno, e React la tratterebbe come un tipo nuovo. */
function RigaGiornata({
  g,
  oggi,
  adesso,
  armata,
  onArma,
  onElimina,
  onCorreggi,
}: {
  g: Giornata;
  oggi: string;
  adesso: Date;
  armata: boolean;
  onArma: () => void;
  onElimina: () => void;
  onCorreggi: (patch: {
    entrata?: string;
    uscita?: string | null;
    pausa_minuti?: number;
  }) => void;
}) {
  const lavorati = minutiLavorati(g, adesso);
  const oltre = minutiOltreOrario(g, adesso);
  const aperta = !g.uscita;
  const eOggi = g.giorno === oggi;

  return (
    <tr
      className={cn(
        "border-b border-border-soft transition-colors last:border-0 hover:bg-accent/40",
        aperta && "bg-brand-50/50",
      )}
    >
      <td className="py-1.5 pl-4 whitespace-nowrap">
        <span
          className={cn(
            "text-[13px] tabular-nums",
            eOggi ? "font-bold text-ink" : "font-medium text-ink-secondary",
          )}
        >
          {eOggi ? "Oggi" : formatDue(g.giorno)}
        </span>
        <span className="ml-1.5 text-[11px] text-ink-faint">
          {GIORNO_FMT.format(new Date(`${g.giorno}T12:00:00`))}
        </span>
      </td>
      <td className="py-1.5">
        <CampoOra
          valore={soloOra(g.entrata)}
          etichetta={`Entrata del ${g.giorno}`}
          onCambia={(hhmm) => {
            const iso = conNuovaOra(g.giorno, hhmm);
            if (iso) onCorreggi({ entrata: iso });
          }}
        />
      </td>
      <td className="py-1.5">
        {aperta ? (
          <span className="inline-flex items-center gap-1.5 px-1.5 text-[12px] font-semibold text-brand-700">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-500"
            />
            in corso
          </span>
        ) : (
          <CampoOra
            valore={soloOra(g.uscita as string)}
            etichetta={`Uscita del ${g.giorno}`}
            onCambia={(hhmm) => {
              const iso = conNuovaOra(g.giorno, hhmm);
              if (iso) onCorreggi({ uscita: iso });
            }}
          />
        )}
      </td>
      <td className="py-1.5">
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
              onCorreggi({ pausa_minuti: min });
            }
          }}
          className="h-8 w-14 rounded-lg border border-transparent bg-transparent px-1.5 font-mono text-[13px] tabular-nums outline-none transition-colors hover:border-input hover:bg-card focus:border-input focus:bg-card focus-visible:ring-2 focus-visible:ring-ring"
        />
      </td>
      <td className="py-1.5 pr-2 text-right font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap text-ink">
        {inOre(lavorati)}
      </td>
      <td className="py-1.5 pr-4 text-right whitespace-nowrap">
        {oltre > 0 ? (
          <span className="rounded-full bg-warning-soft px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-warning-text">
            +{inOre(oltre)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-faint">—</span>
        )}
      </td>
      <td className="py-1.5 pr-4 text-right whitespace-nowrap">
        {g.corretta_at ? (
          <span
            title="Gli orari di questa giornata sono stati scritti a mano"
            className="mr-1 text-[10px] text-ink-faint"
          >
            corretta
          </span>
        ) : null}
        <button
          type="button"
          onClick={armata ? onElimina : onArma}
          aria-label={
            armata
              ? `Conferma: elimina la giornata del ${g.giorno}`
              : `Elimina la giornata del ${g.giorno}`
          }
          title={armata ? "Premi ancora per eliminare" : "Elimina"}
          className={cn(
            "rounded-lg p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            armata
              ? "bg-danger-soft text-danger-text"
              : "text-ink-faint hover:bg-danger-soft/60 hover:text-danger-text",
          )}
        >
          {armata ? (
            <TriangleAlert className="size-3.5" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}
