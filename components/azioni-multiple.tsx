"use client";

import * as React from "react";
import { LoaderCircle, Lock, X } from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { puoAssegnareAdAltri, puoModificareTask } from "@/lib/permessi";
import { useSelezione } from "@/lib/selezione";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Azioni su più task insieme.
 *
 * Cambiare fase a otto task è il gesto di fine giornata, e farlo otto volte
 * è il tipo di attrito che fa abbandonare uno strumento.
 *
 * Il punto delicato non è l'azione, sono i PERMESSI. Su una board condivisa
 * la selezione può contenere task di colleghi, e un dipendente non può
 * toccarli. Le due strade facili sono entrambe sbagliate:
 *
 *   - rifiutare tutto perché uno è bloccato punisce un gesto legittimo;
 *   - agire in silenzio su quelli che si può lascia credere di aver
 *     spostato otto cose quando se ne sono spostate quattro.
 *
 * Quindi si dice PRIMA quanti se ne possono toccare, e dopo si dice cosa è
 * successo davvero. Chi legge non deve mai contare le schede per capirlo.
 */

export function AzioniMultiple() {
  const { ids, pulisci } = useSelezione();
  const { tasks, profiles, projects, statuses, currentUser, updateTask } =
    useAppStore();
  const toast = useToast();
  const [inCorso, setInCorso] = React.useState(false);

  const scelti = React.useMemo(
    () => tasks.filter((t) => ids.has(t.id)),
    [tasks, ids],
  );

  /* Il padre serve al permesso: chi guida un lavoro governa anche i pezzi. */
  const padreDi = React.useCallback(
    (t: Task) =>
      t.parent_id ? (tasks.find((x) => x.id === t.parent_id) ?? null) : null,
    [tasks],
  );

  const modificabili = scelti.filter((t) =>
    puoModificareTask(t, currentUser, padreDi(t)),
  );
  const bloccati = scelti.length - modificabili.length;

  if (scelti.length === 0) return null;

  /** Applica la stessa modifica a tutti quelli che si possono toccare. */
  const applica = async (
    patch: Parameters<typeof updateTask>[1],
    descrizione: string,
  ) => {
    if (modificabili.length === 0) return;
    setInCorso(true);
    const annulla: (() => void)[] = [];
    let riusciti = 0;
    let errore: string | null = null;
    try {
      /* In fila e aspettando l'esito: se il database rifiuta il terzo, chi
         guarda deve saperlo, non scoprirlo ricaricando. */
      for (const t of modificabili) {
        try {
          const undo = await updateTask(t.id, patch);
          if (undo) annulla.push(undo);
          riusciti++;
        } catch (e) {
          errore ??= messaggioErrore(e, "Modifica non riuscita.");
        }
      }
    } finally {
      setInCorso(false);
    }

    const parti = [`${riusciti} ${riusciti === 1 ? "task" : "task"} ${descrizione}`];
    if (bloccati > 0) {
      parti.push(
        `${bloccati} non ${bloccati === 1 ? "è tuo" : "sono tuoi"}: ${bloccati === 1 ? "lasciato" : "lasciati"} com'${bloccati === 1 ? "era" : "erano"}`,
      );
    }
    if (errore) parti.push(errore);

    toast(
      parti.join(" · "),
      annulla.length > 0
        ? {
            /* Un annulla solo per tutto il gruppo: annullarne otto a mano
               sarebbe peggio del problema che si voleva risolvere. */
            action: {
              label: "Annulla",
              onClick: () => {
                for (const u of annulla) u();
              },
            },
          }
        : undefined,
    );
    pulisci();
  };

  const attivi = profiles.filter((p) => p.is_active);
  const progettiVivi = projects.filter((p) => !p.is_archived);

  return (
    <div
      role="region"
      aria-label={`Azioni su ${scelti.length} task selezionati`}
      className="fixed inset-x-0 bottom-4 z-70 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-white/95 px-3 py-2 shadow-[0_16px_48px_rgb(15_23_42/0.18)] backdrop-blur-md"
    >
      <span className="px-1 text-[13px] font-semibold text-ink">
        {scelti.length} selezionat{scelti.length === 1 ? "o" : "i"}
      </span>

      {bloccati > 0 ? (
        /* Si dice PRIMA, non dopo: chi seleziona sette task e ne può
           toccare quattro deve saperlo mentre decide, non a cose fatte. */
        <span
          className="inline-flex items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 text-[12px] font-medium text-warning-text"
          title="Puoi modificare solo i task di cui rispondi"
        >
          <Lock aria-hidden className="size-3" />
          {bloccati} non {bloccati === 1 ? "tuo" : "tuoi"}
        </span>
      ) : null}

      <span className="h-5 w-px bg-border" aria-hidden />

      <label className="sr-only" htmlFor="bulk-stato">
        Sposta in fase
      </label>
      <NativeSelect
        id="bulk-stato"
        className="w-36"
        value=""
        disabled={inCorso || modificabili.length === 0}
        onChange={(e) => {
          const status = e.target.value;
          if (!status) return;
          const meta = statuses.find((s) => s.key === status);
          void applica({ status }, `spostat${modificabili.length === 1 ? "o" : "i"} in «${meta?.label ?? status}»`);
        }}
      >
        <option value="">Sposta in…</option>
        {statuses.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </NativeSelect>

      {puoAssegnareAdAltri(currentUser) ? (
        <>
          <label className="sr-only" htmlFor="bulk-owner">
            Affida a
          </label>
          <NativeSelect
            id="bulk-owner"
            className="w-36"
            value=""
            disabled={inCorso || modificabili.length === 0}
            onChange={(e) => {
              const owner_id = e.target.value;
              if (!owner_id) return;
              const chi = attivi.find((p) => p.id === owner_id);
              void applica(
                { owner_id },
                `affidat${modificabili.length === 1 ? "o" : "i"} a ${chi?.full_name.split(" ")[0] ?? "—"}`,
              );
            }}
          >
            <option value="">Affida a…</option>
            {attivi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </NativeSelect>
        </>
      ) : null}

      <label className="sr-only" htmlFor="bulk-progetto">
        Sposta nel progetto
      </label>
      <NativeSelect
        id="bulk-progetto"
        className="hidden w-36 sm:inline-flex"
        value=""
        disabled={inCorso || modificabili.length === 0}
        onChange={(e) => {
          const scelto = e.target.value;
          if (!scelto) return;
          const project_id = scelto === "__nessuno__" ? null : scelto;
          const nome = progettiVivi.find((p) => p.id === project_id)?.name;
          void applica(
            { project_id },
            project_id
              ? `spostat${modificabili.length === 1 ? "o" : "i"} in «${nome}»`
              : `tolt${modificabili.length === 1 ? "o" : "i"} dal progetto`,
          );
        }}
      >
        <option value="">Progetto…</option>
        <option value="__nessuno__">Nessun progetto</option>
        {progettiVivi.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </NativeSelect>

      {inCorso ? (
        <LoaderCircle aria-hidden className="size-4 animate-spin text-ink-muted" />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={pulisci}
        aria-label="Annulla la selezione"
        title="Annulla la selezione (Esc)"
      >
        <X />
      </Button>
    </div>
  );
}
