"use client";

import { Package, TriangleAlert } from "lucide-react";

import { avanzamentoProcesso, ordinaFasi } from "@/lib/processo";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { SearchLink } from "@/components/search-link";
import { StatusPip } from "@/components/status-pip";
import { Separator } from "@/components/ui/separator";

/**
 * Quadro d'insieme di un processo a più mani.
 *
 * Chi apre una fase vedeva solo la propria: «a che punto siamo?» era una
 * domanda da chat. Qui ci sono tutte le fasi nell'ordine del processo, con
 * chi le ha in carico e come stanno — la propria in evidenza.
 */
export function AvanzamentoProcesso({ task }: { task: Task }) {
  const { tasks, profiles } = useAppStore();

  const fasi = ordinaFasi(
    tasks.filter((t) => t.batch_id && t.batch_id === task.batch_id),
  );
  // Una fase sola non è un processo: sarebbe solo rumore sulla scheda.
  if (fasi.length < 2) return null;

  const { totale, fatte, percento, bloccate, corrente } =
    avanzamentoProcesso(fasi);

  return (
    <section aria-label="Avanzamento del processo" className="px-5 pb-2">
      <Separator className="mb-4" />
      <h3 className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-ink-secondary uppercase">
        <Package className="size-3.5" />
        Processo
        <span className="font-mono text-[11px] font-normal text-ink-muted">
          {fatte}/{totale} fasi
        </span>
        {bloccate > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-danger-text">
            <TriangleAlert className="size-3" />
            {bloccate === 1 ? "1 fase bloccata" : `${bloccate} fasi bloccate`}
          </span>
        ) : null}
      </h3>

      <div
        role="progressbar"
        aria-valuenow={percento}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Processo completato al ${percento}%`}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            percento === 100 ? "bg-success" : "bg-brand-500",
          )}
          style={{ width: `${percento}%` }}
        />
      </div>

      <ol className="mt-2.5 space-y-0.5">
        {fasi.map((fase, i) => {
          const responsabile = profiles.find((p) => p.id === fase.owner_id);
          const questa = fase.id === task.id;
          const riga = (
            <>
              <span className="w-4 shrink-0 text-right font-mono text-[11px] text-ink-faint">
                {i + 1}
              </span>
              <StatusPip status={fase.status} className="size-3 shrink-0" />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px]",
                  fase.status === "done" && "text-ink-muted line-through",
                  questa ? "font-semibold text-ink" : "text-ink-secondary",
                )}
              >
                {fase.title}
              </span>
              {responsabile ? (
                <span
                  className="flex shrink-0 items-center gap-1.5"
                  title={`Responsabile: ${responsabile.full_name}`}
                >
                  <AvatarInitials name={responsabile.full_name} size="sm" />
                  <span className="hidden text-[11px] text-ink-muted sm:inline">
                    {responsabile.full_name.split(" ")[0]}
                  </span>
                </span>
              ) : null}
              <DueChip iso={fase.due_date} status={fase.status} />
            </>
          );

          return (
            <li key={fase.id}>
              {questa ? (
                <div
                  aria-current="step"
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-1.5 py-1.5"
                >
                  {riga}
                </div>
              ) : (
                <SearchLink
                  params={{ task: fase.id }}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {riga}
                </SearchLink>
              )}
            </li>
          );
        })}
      </ol>

      {corrente && corrente.id !== task.id ? (
        <p className="mt-2 px-1.5 text-[12px] text-ink-muted">
          Adesso tocca a{" "}
          <span className="font-medium text-ink-secondary">
            {profiles
              .find((p) => p.id === corrente.owner_id)
              ?.full_name.split(" ")[0] ?? "qualcuno"}
          </span>{" "}
          con «{corrente.title}».
        </p>
      ) : null}
    </section>
  );
}
