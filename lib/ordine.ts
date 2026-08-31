import type { Task } from "@/lib/types";

/**
 * In che ordine sta il lavoro.
 *
 * La regola esisteva già, ma in un punto solo — la vista Elenco — mentre
 * board, frecce del pannello e blocchi della dashboard ordinavano per
 * `position`, cioè per il momento in cui il task era stato creato
 * (`position: Date.now()`). Il risultato: un lavoro urgente appena scritto
 * compariva in cima all'elenco e in fondo alla board, e le due viste degli
 * stessi task raccontavano cose diverse.
 *
 * Chi apre la board vuole sapere cosa scade prima. Quindi:
 *
 *   1. prima chi ha una scadenza, dalla più vicina alla più lontana;
 *   2. poi chi non ne ha, nell'ordine deciso a mano.
 *
 * Un lavoro senza data non è «meno urgente di tutti»: è semplicemente un
 * lavoro di cui nessuno ha detto quando serve, e mescolarlo alle scadenze
 * renderebbe la colonna illeggibile.
 *
 * Che la regola stia qui e non dentro le viste è il punto: erano cinque
 * copie a divergere, ed è così che si erano divise.
 */
export function confrontaPerScadenza(
  a: Pick<Task, "due_date" | "position">,
  b: Pick<Task, "due_date" | "position">,
): number {
  if (!a.due_date && !b.due_date) return a.position - b.position;
  /* Senza data si va in fondo, ma senza perdere l'ordine fra pari. */
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  /* Le date sono ISO (2026-09-01): il confronto come testo è già
     cronologico, e non costruisce un oggetto Date per ogni paragone. */
  return a.due_date.localeCompare(b.due_date);
}

/** L'elenco ordinato, senza toccare quello di partenza. */
export function ordinaPerScadenza<T extends Pick<Task, "due_date" | "position">>(
  tasks: T[],
): T[] {
  return [...tasks].sort(confrontaPerScadenza);
}

/**
 * Trascinando dentro la stessa colonna, il posto scelto reggerà?
 *
 * Da quando l'ordine segue le scadenze, spostare a mano un lavoro che una
 * scadenza ce l'ha non attacca: la data lo riporta al suo posto. Meglio
 * dirlo che lasciar credere che il trascinamento non abbia funzionato.
 */
export function loSpostamentoReggera(
  task: Pick<Task, "due_date">,
  statoDiPartenza: string,
  statoDiArrivo: string,
): boolean {
  if (statoDiPartenza !== statoDiArrivo) return true;
  return !task.due_date;
}
