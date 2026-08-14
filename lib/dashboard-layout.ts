"use client";

import * as React from "react";

import { usePreferenzaSincronizzata } from "@/lib/use-preferenza";

/** Blocchi componibili della dashboard; l'hero resta fisso in testa. */
export type DashboardBlockId =
  | "kpi"
  | "focus"
  | "alerts"
  | "mine"
  | "team"
  | "overdue"
  | "week";

/** Larghezze a preset sulla griglia lg a 12 colonne (3/4/5/6). */
export type DashboardBlockSize = "S" | "M" | "L" | "XL";

export interface DashboardBlockState {
  id: DashboardBlockId;
  size: DashboardBlockSize;
  visible: boolean;
}

export const SIZE_ORDER: readonly DashboardBlockSize[] = ["S", "M", "L", "XL"];

export const SIZE_COLS: Record<DashboardBlockSize, number> = {
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
};

/** Tailwind richiede le classi per intero: niente col-span costruiti. */
export const SIZE_SPAN: Record<DashboardBlockSize, string> = {
  S: "lg:col-span-3",
  M: "lg:col-span-4",
  L: "lg:col-span-5",
  XL: "lg:col-span-6",
};
export const FULL_SPAN = "lg:col-span-12";

export const BLOCK_META: Record<
  DashboardBlockId,
  { title: string; /** Sempre a larghezza piena, non ridimensionabile. */ fullWidth?: boolean }
> = {
  kpi: { title: "Indicatori", fullWidth: true },
  focus: { title: "Focus di oggi" },
  alerts: { title: "Avvisi recenti" },
  mine: { title: "I miei task aperti" },
  team: { title: "Polso del team" },
  overdue: { title: "In ritardo" },
  week: { title: "In scadenza questa settimana" },
};

/** Il default riproduce la composizione asimmetrica storica (3+5+4 / 5+3+4). */
export const DEFAULT_DASHBOARD_LAYOUT: readonly DashboardBlockState[] = [
  { id: "kpi", size: "XL", visible: true },
  { id: "focus", size: "S", visible: true },
  { id: "alerts", size: "L", visible: true },
  { id: "mine", size: "M", visible: true },
  { id: "team", size: "L", visible: true },
  { id: "overdue", size: "S", visible: true },
  { id: "week", size: "M", visible: true },
];

const STORAGE_KEY = "dashboard-layout";
const LAYOUT_VERSION = 1;

/** Un salvataggio è affidabile solo se validato: id ignoti scartati,
 *  blocchi mancanti (feature nuove) riaggiunti in coda col loro default. */
function sanitize(raw: unknown): DashboardBlockState[] | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { version?: number; blocks?: unknown };
  if (data.version !== LAYOUT_VERSION || !Array.isArray(data.blocks)) {
    return null;
  }
  const seen = new Set<DashboardBlockId>();
  const out: DashboardBlockState[] = [];
  for (const item of data.blocks) {
    if (!item || typeof item !== "object") continue;
    const { id, size, visible } = item as Partial<DashboardBlockState>;
    if (!id || !(id in BLOCK_META) || seen.has(id)) continue;
    seen.add(id);
    const fallback = DEFAULT_DASHBOARD_LAYOUT.find((b) => b.id === id)!;
    out.push({
      id,
      size:
        size && (SIZE_ORDER as readonly string[]).includes(size)
          ? size
          : fallback.size,
      visible: typeof visible === "boolean" ? visible : true,
    });
  }
  for (const def of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(def.id)) out.push({ ...def });
  }
  return out;
}

/**
 * Layout della dashboard: nel browser per applicarlo prima che la rete
 * risponda, su Supabase per ritrovarlo da un altro computer
 * (`user_preferences.dashboard_layout`).
 */
export function useDashboardLayout() {
  const [blocks, setBlocks] = React.useState<DashboardBlockState[]>(() =>
    DEFAULT_DASHBOARD_LAYOUT.map((b) => ({ ...b })),
  );
  const blocksRef = React.useRef(blocks);
  React.useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  /* Si salva l'involucro con la versione, non il solo elenco: `sanitize`
     scarta i layout di versioni precedenti invece di disegnare blocchi che
     non esistono più. */
  const salvato = React.useMemo(
    () => ({ version: LAYOUT_VERSION, blocks }),
    [blocks],
  );

  usePreferenzaSincronizzata(
    STORAGE_KEY,
    "dashboard_layout",
    salvato,
    (v) => {
      const pulito = sanitize(v);
      if (pulito) setBlocks(pulito);
    },
    (grezzo) => grezzo as { version: number; blocks: DashboardBlockState[] },
  );

  /** Sposta di ±1; ritorna l'indice di arrivo (null se già al bordo). */
  const move = React.useCallback(
    (id: DashboardBlockId, delta: -1 | 1): number | null => {
      const from = blocksRef.current.findIndex((b) => b.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= blocksRef.current.length) return null;
      setBlocks((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
      return to;
    },
    [],
  );

  /** Sposta a un indice assoluto (clampato); ritorna l'indice effettivo. */
  const moveTo = React.useCallback(
    (id: DashboardBlockId, index: number): number | null => {
      const from = blocksRef.current.findIndex((b) => b.id === id);
      if (from < 0) return null;
      const to = Math.max(0, Math.min(index, blocksRef.current.length - 1));
      if (to === from) return null;
      setBlocks((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
      return to;
    },
    [],
  );

  const setSize = React.useCallback(
    (id: DashboardBlockId, size: DashboardBlockSize) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, size } : b)),
      );
    },
    [],
  );

  /** Ritorna il nuovo stato di visibilità. */
  const toggleVisible = React.useCallback((id: DashboardBlockId): boolean => {
    const current = blocksRef.current.find((b) => b.id === id);
    const next = !(current?.visible ?? true);
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, visible: next } : b)),
    );
    return next;
  }, []);

  const reset = React.useCallback(() => {
    setBlocks(DEFAULT_DASHBOARD_LAYOUT.map((b) => ({ ...b })));
  }, []);

  const isCustomized =
    JSON.stringify(blocks) !== JSON.stringify(DEFAULT_DASHBOARD_LAYOUT);

  return { blocks, move, moveTo, setSize, toggleVisible, reset, isCustomized };
}
