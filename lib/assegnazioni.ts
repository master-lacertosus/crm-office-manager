import type { AppNotification } from "@/lib/types";

/**
 * Il lavoro che ti è arrivato e che non hai ancora visto.
 *
 * Gli avvisi li scrive il database (migrazione M14): una task che nasce con
 * un responsabile diverso da chi la crea, o che cambia responsabile, produce
 * una riga in `notifications` di natura «assegnazione». Qui non si decide
 * *se* avvisare — quella regola sta nel trigger, dove i dati cambiano — ma
 * soltanto come leggerli.
 *
 * Sta in un modulo suo e non dentro il banner perché le stesse risposte
 * servono a tre posti diversi (il banner, il tab della campanella, il
 * contatore sulla voce Task): tre conteggi calcolati ognuno per conto suo
 * sarebbero liberi di dire numeri diversi, e il primo che sbaglia distrugge
 * la fiducia negli altri due.
 */

/** Gli avvisi di lavoro arrivato, non ancora letti, dal più recente. */
export function nonViste(
  avvisi: readonly AppNotification[],
): AppNotification[] {
  return avvisi.filter((n) => n.kind === "assegnazione" && !n.read_at);
}

/**
 * Quelli che il banner deve ancora mostrare.
 *
 * Chiudere il banner vuol dire «per ora basta», non «segna letto»: il numero
 * resta nella campanella e sulla voce Task. Ma se arriva un lavoro nuovo il
 * banner deve tornare, e per questo si ricordano gli id e non il conteggio:
 * chi mette via tre avvisi e poi ne riceve due, con il conteggio non vedrebbe
 * più niente — due non è più di tre — e il lavoro nuovo sparirebbe in
 * silenzio, che è esattamente il difetto che questa funzionalità esiste per
 * togliere.
 */
export function daMostrare(
  nonLette: readonly AppNotification[],
  messeVia: ReadonlySet<string>,
): AppNotification[] {
  return nonLette.filter((n) => !messeVia.has(n.id));
}

/** «Hai 3 nuove task assegnate» — al singolare quando è una sola. */
export function frase(quante: number): string {
  return quante === 1
    ? "Hai 1 nuova task assegnata"
    : `Hai ${quante} nuove task assegnate`;
}

/**
 * Dove porta il banner.
 *
 * Una sola: si apre quella, perché è la risposta completa. Più d'una:
 * l'elenco dei propri lavori, che è dove si decide da quale cominciare —
 * aprirne una a caso sceglierebbe al posto di chi legge.
 */
export function destinazione(
  daVedere: readonly AppNotification[],
  utenteId: string,
): string {
  const una = daVedere.length === 1 && daVedere[0].task_id;
  return una ? `/tasks?task=${una}` : `/tasks?owner=${utenteId}&view=list`;
}
