import {
  nextWeekdayIso,
  shiftIsoDays,
  shiftIsoMonths,
  todayIso,
} from "@/lib/format";
import { REPEAT_META, type TaskRepeat } from "@/lib/types";

/** Calcolo delle ricorrenze: una sola regola, usata dallo store quando un
 *  task ricorrente viene completato e dai controlli di verifica. */

/** Scadenza del giro immediatamente successivo a `iso`. */
export function scadenzaSuccessiva(
  iso: string,
  repeat: Exclude<TaskRepeat, "none">,
): string {
  const { step } = REPEAT_META[repeat];
  if (step.unit === "month") return shiftIsoMonths(iso, step.every);
  if (step.unit === "weekday") return nextWeekdayIso(iso);
  return shiftIsoDays(iso, step.every);
}

/**
 * Scadenza del prossimo giro che NON sia già passato.
 *
 * Completare in ritardo un ricorrente faceva nascere il successivo già
 * scaduto: con la cadenza mensile passava inosservato, con «ogni giorno» il
 * task rinasceva in ritardo a ogni giro, trascinandosi dietro l'arretrato.
 * I giri saltati restano saltati: si riparte dal primo utile.
 */
export function prossimaScadenza(
  iso: string,
  repeat: Exclude<TaskRepeat, "none">,
  oggi: string = todayIso(),
): string {
  let next = scadenzaSuccessiva(iso, repeat);
  // Tetto di sicurezza: con le cadenze fitte una data molto vecchia
  // richiederebbe troppi giri (e non ha senso recuperarli tutti).
  for (let giri = 0; giri < 500 && next < oggi; giri++) {
    next = scadenzaSuccessiva(next, repeat);
  }
  return next;
}
