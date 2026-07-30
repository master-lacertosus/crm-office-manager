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
