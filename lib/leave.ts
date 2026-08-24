import {
  diffIsoDays,
  formatDue,
  isWeekendIso,
  shiftIsoDays,
} from "@/lib/format";
import type { CompanyClosure, LeaveRequest } from "@/lib/types";

/** Logica condivisa di ferie/permessi e chiusure (pura, senza React). */

/** Due intervalli ISO inclusivi si sovrappongono? */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** L'intervallo copre il giorno? */
export function rangeCovers(start: string, end: string, dayIso: string): boolean {
  return start <= dayIso && dayIso <= end;
}

/** «12–16 ago» (o «12 ago» se giorno singolo). */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDue(start);
  const [sameMonth, endLabel] = [
    start.slice(0, 7) === end.slice(0, 7),
    formatDue(end),
  ];
  return sameMonth
    ? `${Number(start.slice(8, 10))}–${endLabel}`
    : `${formatDue(start)} – ${endLabel}`;
}

/**
 * Giorni LAVORATIVI dell'intervallo: esclude weekend e chiusure aziendali
 * (un giorno di chiusura non consuma ferie). È il numero mostrato ovunque.
 */
export function workingDaysCount(
  start: string,
  end: string,
  closures: CompanyClosure[],
): number {
  if (end < start) return 0;
  let count = 0;
  const span = Math.min(diffIsoDays(start, end), 366);
  for (let i = 0; i <= span; i++) {
    const day = shiftIsoDays(start, i);
    if (isWeekendIso(day)) continue;
    if (closures.some((c) => rangeCovers(c.start_date, c.end_date, day)))
      continue;
    count++;
  }
  return count;
}

/** Assenze approvate che coprono il giorno (per calendario e presenze). */
export function leavesOnDay(
  leaves: LeaveRequest[],
  dayIso: string,
): LeaveRequest[] {
  return leaves.filter(
    (l) =>
      l.status === "approved" &&
      rangeCovers(l.start_date, l.end_date, dayIso),
  );
}

/** L'assenza approvata della persona nel giorno, se c'è. */
export function personLeaveOnDay(
  leaves: LeaveRequest[],
  profileId: string,
  dayIso: string,
): LeaveRequest | undefined {
  return leaves.find(
    (l) =>
      l.requester_id === profileId &&
      l.status === "approved" &&
      rangeCovers(l.start_date, l.end_date, dayIso),
  );
}

/** La chiusura aziendale che copre il giorno, se c'è. */
export function closureOnDay(
  closures: CompanyClosure[],
  dayIso: string,
): CompanyClosure | undefined {
  return closures.find((c) =>
    rangeCovers(c.start_date, c.end_date, dayIso),
  );
}
