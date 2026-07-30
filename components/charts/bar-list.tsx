"use client";

import type { ProjectLoad } from "@/lib/analytics";

/**
 * Elenco a barre (serie singola, grafite): l'identità la danno le etichette
 * di riga, i valori sono etichettati direttamente — niente legenda.
 */
export function BarList({ rows }: { rows: ProjectLoad[] }) {
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
              className="h-full rounded-r-[4px] bg-ink-secondary transition-[width] duration-300"
              style={{ width: `${(row.total / max) * 100}%` }}
              aria-hidden
            />
          </div>
          <p className="font-mono text-xs text-ink-muted">
            <span className="font-medium text-ink">{row.open}</span> aperti ·{" "}
            {row.total}
          </p>
        </div>
      ))}
    </div>
  );
}
