import type { Task } from "@/lib/types";

/**
 * Il contesto di un pezzo: da quale lavoro viene e cosa chiedeva.
 *
 * Un lavoro grande si spezza in pezzi affidati a persone diverse, e i
 * pezzi nascono col solo titolo perché è il padre a contenere il perché.
 * Finché il padre non si vedeva, chi apriva il proprio pezzo leggeva
 * «Check video prodotto disponibili» e basta: il brief esisteva, salvo e
 * intero, ma non c'era modo di arrivarci — e nemmeno di sapere che
 * esistesse.
 *
 * Il testo non si copia nel pezzo: resta uno solo, sul padre. Copiarlo
 * vorrebbe dire avere due versioni della stessa richiesta, e sbagliare
 * ogni volta che una delle due viene corretta.
 */
export function contestoDelPezzo(
  task: Pick<Task, "parent_id">,
  tasks: Task[],
): { padre: Task; richiesta: string | null } | null {
  if (!task.parent_id) return null;

  /* Si cerca nell'elenco completo, non in quello filtrato della board: il
     padre è spesso di un altro, e da quando ognuno apre il CRM sui propri
     lavori non comparirebbe. Chi ha in mano il pezzo deve arrivarci lo
     stesso. */
  const padre = tasks.find((t) => t.id === task.parent_id);
  if (!padre) return null;

  const richiesta = padre.description?.trim();
  return { padre, richiesta: richiesta ? richiesta : null };
}
