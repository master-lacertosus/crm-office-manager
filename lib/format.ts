/** Utility di formattazione (UI in italiano, dati in mono). */

const dueFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
});

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sposta una data ISO di n giorni. */
export function shiftIsoDays(iso: string, days: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, dd + days);
  return toIso(d);
}

/** Sposta una data ISO di n mesi (stesso giorno del mese, clampato). */
export function shiftIsoMonths(iso: string, months: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dd, lastDay));
  return toIso(d);
}

/** Differenza in giorni tra due ISO (b - a). */
export function diffIsoDays(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round(
    (new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime()) /
      86_400_000,
  );
}

/** "2026-09-12" → "12 set" */
export function formatDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dueFormat.format(new Date(y, m - 1, d));
}

export type DueTone = "overdue" | "today" | "future";

export function dueTone(iso: string): DueTone {
  const today = todayIso();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  return "future";
}

/**
 * Modello di urgenza delle scadenze — UNICA fonte per tutta l'app
 * (docs/design-system.md §6b): in ritardo, scade oggi, imminente (≤2 g),
 * altrimenti neutra. `days` è la distanza assoluta in giorni.
 */
export type DueUrgencyLevel = "overdue" | "today" | "soon" | "later";

export function dueUrgency(iso: string): { level: DueUrgencyLevel; days: number } {
  const days = diffIsoDays(todayIso(), iso);
  if (days < 0) return { level: "overdue", days: -days };
  if (days === 0) return { level: "today", days: 0 };
  if (days <= 2) return { level: "soon", days };
  return { level: "later", days };
}

/** Tempo relativo breve per i commenti: "adesso", "35 min fa", "2 h fa", "3 g fa". */
export function timeAgo(isoDateTime: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoDateTime).getTime()) / 60_000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.floor(hours / 24)} g fa`;
}

/** "Marco Bianchi" → "MB" */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}
