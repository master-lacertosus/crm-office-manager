"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, TriangleAlert } from "lucide-react";

import { costruisciAgenda, INTERVALLI } from "@/lib/agenda";
import { responsabileEffettivo } from "@/lib/filtro-responsabile";
import { addDaysIso, dueUrgency, todayIso } from "@/lib/format";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { SearchLink } from "@/components/search-link";
import { StatusPip } from "@/components/status-pip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented, SegmentedButton } from "@/components/ui/segmented";

const GIORNO_LUNGO = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** «venerdì 4 settembre», con la maiuscola che l'italiano vuole. */
function intestazioneGiorno(iso: string, oggi: string): string {
  if (iso === oggi) return "Oggi";
  if (iso === addDaysIso(1)) return "Domani";
  const t = GIORNO_LUNGO.format(new Date(`${iso}T12:00:00`));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * L'agenda: cosa c'è da consegnare, giorno per giorno.
 *
 * Board ed Elenco dicono a che punto è il lavoro. Questa dice quando
 * scade — ed è la domanda che ci si fa il lunedì mattina. L'intervallo è
 * libero in avanti e all'indietro, perché servono entrambe le direzioni:
 * avanti per prepararsi, indietro per rivedere cosa è stato consegnato.
 *
 * Il filtro persona è lo stesso di board ed elenco (`?owner=`), quindi il
 * predefinito segue il ruolo: un dipendente apre la sua agenda, un
 * responsabile quella di tutti. «La propria agenda» non è una pagina a
 * parte: è questa, con il proprio nome — e il collega si raggiunge con un
 * clic invece che con un altro menu da imparare.
 */
export function AgendaView() {
  const { tasks, profiles, projects, currentUser } = useAppStore();
  const searchParams = useSearchParams();
  const oggi = todayIso();

  const owner = responsabileEffettivo(searchParams.get("owner"), currentUser);
  const progetto = searchParams.get("project");

  const daUrl = searchParams.get("da");
  const aUrl = searchParams.get("a");
  const completate = searchParams.get("fatte") === "1";
  const senzaData = searchParams.get("nodata") === "1";

  /* L'intervallo vive nell'indirizzo: così un'agenda si manda a un collega
     e lui vede la stessa cosa, senza doverla ricostruire. */
  const da = daUrl ?? oggi;
  const a = aUrl ?? addDaysIso(6);

  const preimpostato = INTERVALLI.find(
    (i) => da === oggi && a === addDaysIso(i.giorniAvanti),
  )?.chiave;

  const filtrate = React.useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!owner || t.owner_id === owner) &&
          (!progetto || t.project_id === progetto),
      ),
    [tasks, owner, progetto],
  );

  const agenda = React.useMemo(
    () =>
      costruisciAgenda(filtrate, {
        da,
        a,
        oggi,
        includiCompletate: completate,
        includiSenzaData: senzaData,
      }),
    [filtrate, da, a, oggi, completate, senzaData],
  );

  const chi = (id: string) => profiles.find((p) => p.id === id);
  const nomeProgetto = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? null) : null;

  const riga = (t: (typeof tasks)[number]) => (
    <SearchLink
      key={t.id}
      params={{ task: t.id }}
      className="card-soft flex min-w-0 items-center gap-2.5 px-3 py-2.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <StatusPip status={t.status} className="size-3.5 shrink-0" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-ink",
          t.status === "done" && "text-ink-muted line-through",
        )}
      >
        {t.title}
      </span>
      {nomeProgetto(t.project_id) ? (
        <span className="hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink-secondary sm:inline">
          {nomeProgetto(t.project_id)}
        </span>
      ) : null}
      {t.priority === "high" ? (
        <span className="shrink-0 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-text">
          Alta
        </span>
      ) : null}
      {t.due_date ? <DueChip iso={t.due_date} status={t.status} /> : null}
      {chi(t.owner_id) ? (
        <AvatarInitials
          name={chi(t.owner_id)!.full_name}
          src={chi(t.owner_id)!.avatar_url}
          size="sm"
        />
      ) : null}
    </SearchLink>
  );

  return (
    <div className="flex-1 space-y-5 px-4 py-4 sm:px-6">
      {/* --- Comandi --- */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented aria-label="Intervallo">
          {INTERVALLI.map(({ chiave, etichetta, giorniAvanti }) => (
            <SegmentedButton
              key={chiave}
              active={preimpostato === chiave}
              onClick={() =>
                updateSearch(
                  { da: oggi, a: addDaysIso(giorniAvanti) },
                  { replace: true },
                )
              }
            >
              {etichetta}
            </SegmentedButton>
          ))}
        </Segmented>

        <div className="flex items-center gap-1.5">
          <Label htmlFor="agenda-da" className="sr-only">
            Dal giorno
          </Label>
          <Input
            id="agenda-da"
            type="date"
            value={da}
            /* Nessun tetto: l'agenda serve soprattutto per guardare avanti. */
            onChange={(e) =>
              e.target.value &&
              updateSearch({ da: e.target.value }, { replace: true })
            }
            className="h-8 w-36 text-[13px]"
          />
          <span className="text-xs text-ink-muted">→</span>
          <Label htmlFor="agenda-a" className="sr-only">
            Al giorno
          </Label>
          <Input
            id="agenda-a"
            type="date"
            value={a}
            onChange={(e) =>
              e.target.value &&
              updateSearch({ a: e.target.value }, { replace: true })
            }
            className="h-8 w-36 text-[13px]"
          />
        </div>

        <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <input
            type="checkbox"
            checked={completate}
            onChange={(e) =>
              updateSearch(
                { fatte: e.target.checked ? "1" : null },
                { replace: true },
              )
            }
            className="size-4 accent-(--brand-500)"
          />
          Mostra completate
        </label>

        <label className="flex items-center gap-1.5 text-[13px] text-ink-secondary">
          <input
            type="checkbox"
            checked={senzaData}
            onChange={(e) =>
              updateSearch(
                { nodata: e.target.checked ? "1" : null },
                { replace: true },
              )
            }
            className="size-4 accent-(--brand-500)"
          />
          Senza scadenza
        </label>

        <span className="ml-auto font-mono text-xs text-ink-muted">
          {agenda.totale} {agenda.totale === 1 ? "lavoro" : "lavori"}
        </span>
      </div>

      {/* --- Arretrati --- */}
      {agenda.arretrati.length > 0 ? (
        <section aria-label="In ritardo">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-danger-text uppercase">
            <TriangleAlert className="size-3.5" />
            In ritardo
            <span className="font-mono font-normal">
              {agenda.arretrati.length}
            </span>
          </h2>
          <div className="space-y-1.5">{agenda.arretrati.map(riga)}</div>
        </section>
      ) : null}

      {/* --- Giorno per giorno --- */}
      {agenda.giorni.map(({ giorno, lavori }) => (
        <section key={giorno} aria-label={giorno}>
          <h2
            className={cn(
              "mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.05em] uppercase",
              giorno === oggi ? "text-brand-600" : "text-ink-secondary",
              dueUrgency(giorno).level === "overdue" && "text-danger-text",
            )}
          >
            {intestazioneGiorno(giorno, oggi)}
            <span className="font-mono font-normal text-ink-muted">
              {lavori.length}
            </span>
          </h2>
          <div className="space-y-1.5">{lavori.map(riga)}</div>
        </section>
      ))}

      {/* --- Senza scadenza --- */}
      {agenda.senzaData.length > 0 ? (
        <section aria-label="Senza scadenza">
          <h2 className="mb-2 text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
            Senza scadenza
            <span className="ml-2 font-mono font-normal">
              {agenda.senzaData.length}
            </span>
          </h2>
          <div className="space-y-1.5">{agenda.senzaData.map(riga)}</div>
        </section>
      ) : null}

      {agenda.totale === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[13px] text-ink-muted">
          <CalendarClock aria-hidden className="mx-auto mb-2 size-5" />
          Niente in agenda in questo intervallo.
        </p>
      ) : null}
    </div>
  );
}
