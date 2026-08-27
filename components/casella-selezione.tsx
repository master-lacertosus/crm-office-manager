"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { useSelezione } from "@/lib/selezione";
import { cn } from "@/lib/utils";

/**
 * La casella per scegliere un task senza aprirlo.
 *
 * Vive dentro il link che porta al dettaglio, quindi deve fermare l'evento
 * su tutti e tre i fronti: il clic (che navigherebbe), il puntatore (che
 * farebbe partire il trascinamento della scheda) e il tasto Invio.
 * Dimenticarne uno significa che selezionare un task lo apre, oppure lo
 * sposta di colonna.
 *
 * Resta invisibile finché non serve: compare al passaggio del mouse, con il
 * fuoco da tastiera, o quando c'è già una selezione in corso — che è il
 * momento in cui si vogliono vedere tutte le caselle insieme.
 */
export function CasellaSelezione({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const { ids, commuta } = useSelezione();
  const scelto = ids.has(taskId);
  const qualcunoScelto = ids.size > 0;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={scelto}
      aria-label={scelto ? "Togli dalla selezione" : "Aggiungi alla selezione"}
      onPointerDown={(e) => {
        /* Senza questo, premere sulla casella comincia a trascinare la
           scheda: si finisce per spostare di fase un task che si voleva
           solo scegliere. */
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        commuta(taskId);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          commuta(taskId);
        }
      }}
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-[5px] border outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
        scelto
          ? "border-brand-500 bg-brand-500 text-white opacity-100"
          : "border-input bg-white text-transparent hover:border-brand-400",
        !scelto && !qualcunoScelto && "opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </button>
  );
}
