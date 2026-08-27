"use client";

import { TriangleAlert, X } from "lucide-react";

import { useAppStore } from "@/lib/store";

/**
 * Avviso di scrittura non riuscita.
 *
 * Lo store annulla da solo le modifiche che il database rifiuta: senza questo
 * banner l'annullamento avviene in silenzio, e chi guarda vede la propria
 * modifica sparire senza sapere perché. È il difetto peggiore possibile —
 * peggio di un errore, perché non sembra nemmeno un errore.
 *
 * Non è un toast: un toast se ne va da solo, e «non ho salvato» merita di
 * restare finché non lo si è letto.
 *
 * Il testo arriva dal database: «Operazione negata: è l'ultimo admin attivo»,
 * «Non si decide sulla propria richiesta di assenza». Sono già in italiano e
 * dicono la ragione vera; riformularli li renderebbe solo più vaghi.
 */
export function SyncErrorBanner() {
  const { syncError, clearSyncError } = useAppStore();
  if (!syncError) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 z-100 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-danger/30 bg-card px-3.5 py-3 shadow-[0_16px_48px_rgb(15_23_42/0.2)]"
    >
      <TriangleAlert
        className="mt-px size-4 shrink-0 text-danger"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          Modifica non salvata
        </p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">{syncError}</p>
        <p className="mt-1 text-[12px] text-ink-muted">
          L&rsquo;app è tornata a com&rsquo;era prima: quello che vedi ora è
          quello che c&rsquo;è davvero sul database.
        </p>
      </div>
      <button
        onClick={clearSyncError}
        aria-label="Chiudi l'avviso"
        className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-accent hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
