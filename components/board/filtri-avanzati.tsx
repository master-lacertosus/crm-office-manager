"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";

import {
  ETICHETTE_PRIORITA,
  ETICHETTE_SCADENZA,
  leggiFiltri,
  quantiFiltriAvanzati,
} from "@/lib/filtri";
import { pop } from "@/lib/motion";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * I criteri oltre a responsabile e progetto: priorità, fase, scadenza,
 * ricerca.
 *
 * Stanno dietro un pulsante e non in fila nella barra per una ragione
 * pratica: sei menu affiancati non entrano nell'intestazione nemmeno su uno
 * schermo largo, e su un portatile mangerebbero la riga del titolo. Dietro
 * il pulsante c'è anche spazio per crescere senza rifare la barra ogni
 * volta.
 *
 * Il numero sul pulsante non è decorazione: un filtro che nasconde metà
 * della board senza mostrarsi è il modo più veloce per far credere che i
 * dati siano spariti. Finché c'è qualcosa di acceso, si vede.
 */
export function FiltriAvanzati({ idPrefix = "adv" }: { idPrefix?: string }) {
  const { statuses, currentUser } = useAppStore();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtri = leggiFiltri(new URLSearchParams(searchParams), currentUser);
  const accesi = quantiFiltriAvanzati(filtri);

  const set = (chiave: string, valore: string) =>
    updateSearch({ [chiave]: valore || null }, { replace: true });

  const azzera = () =>
    updateSearch(
      { priority: null, stato: null, scadenza: null, q: null },
      { replace: true },
    );

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          accesi > 0
            ? `Filtri: ${accesi} ${accesi === 1 ? "criterio attivo" : "criteri attivi"}`
            : "Filtri"
        }
        className={cn(accesi > 0 && "border-brand-300 text-brand-700")}
      >
        <SlidersHorizontal />
        Filtri
        {accesi > 0 ? (
          <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-[10px] font-bold text-white">
            {accesi}
          </span>
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="Filtri avanzati"
            className="glass-strong absolute right-0 z-50 mt-2 w-[280px] origin-top-right space-y-3 rounded-xl p-3"
          >
            <div className="space-y-1">
              <label
                htmlFor={`${idPrefix}-q`}
                className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase"
              >
                Cerca
              </label>
              <input
                id={`${idPrefix}-q`}
                type="search"
                value={searchParams.get("q") ?? ""}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Nel titolo o nella descrizione…"
                className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`${idPrefix}-priority`}
                className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase"
              >
                Priorità
              </label>
              <NativeSelect
                id={`${idPrefix}-priority`}
                className="w-full"
                value={searchParams.get("priority") ?? ""}
                onChange={(e) => set("priority", e.target.value)}
              >
                <option value="">Tutte</option>
                {(["high", "normal", "low"] as const).map((p) => (
                  <option key={p} value={p}>
                    {ETICHETTE_PRIORITA[p]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`${idPrefix}-stato`}
                className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase"
              >
                Fase
              </label>
              {/* Le fasi arrivano dallo store, personalizzate comprese: un
                  elenco scritto a mano qui dimenticherebbe quelle che il
                  workspace si è aggiunto da sé. */}
              <NativeSelect
                id={`${idPrefix}-stato`}
                className="w-full"
                value={searchParams.get("stato") ?? ""}
                onChange={(e) => set("stato", e.target.value)}
              >
                <option value="">Tutte</option>
                {statuses.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label
                htmlFor={`${idPrefix}-scadenza`}
                className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase"
              >
                Scadenza
              </label>
              <NativeSelect
                id={`${idPrefix}-scadenza`}
                className="w-full"
                value={searchParams.get("scadenza") ?? ""}
                onChange={(e) => set("scadenza", e.target.value)}
              >
                <option value="">Qualsiasi</option>
                {(["ritardo", "oggi", "settimana", "senza"] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {ETICHETTE_SCADENZA[s]}
                    </option>
                  ),
                )}
              </NativeSelect>
            </div>

            {accesi > 0 ? (
              <button
                onClick={azzera}
                className="w-full rounded-lg py-1.5 text-[12px] font-semibold text-brand-700 outline-none transition-colors hover:bg-brand-500/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                Azzera i filtri avanzati
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
