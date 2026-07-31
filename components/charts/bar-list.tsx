"use client";

import type { ProjectLoad } from "@/lib/analytics";

/**
 * Elenco a barre: identità nelle etichette di riga, valori etichettati
 * direttamente — niente legenda. Il colore segue l'entità (mai il rango):
 * lo assegna il chiamante in modo stabile.
 */
export function BarList({
  rows,
  colors,
  valueOnly = false,
}: {
  rows: ProjectLoad[];
  colors: Map<string, string>;
  /** Mostra solo il totale (es. «Completati per persona»), senza «aperti». */
  valueOnly?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(0,40%)_1fr_auto] items-center gap-3"
        >
          <p className="truncate text-[13px] text-ink-secondary">{row.label}</p>
          <div className="h-[18px]">
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-300"
              style={{
                width: `${(row.total / max) * 100}%`,
                background: colors.get(row.key) ?? "#94A3B8",
              }}
              aria-hidden
            />
          </div>
          {valueOnly ? (
            <p className="font-mono text-xs font-medium text-ink">
              {row.total}
            </p>
          ) : (
            <p className="font-mono text-xs text-ink-muted">
              <span className="font-medium text-ink">{row.open}</span> aperti ·{" "}
              {row.total}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
