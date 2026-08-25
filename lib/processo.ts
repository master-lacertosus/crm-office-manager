/**
 * Processi a più mani: i template che si aprono in più fasi.
 *
 * Ogni fase è un task vero, con un solo responsabile — la regola del prodotto
 * non cambia («ogni task ha un responsabile»). Quello che mancava era il
 * quadro d'insieme: chi guarda una fase non vedeva a che punto è il resto.
 *
 * Nessun import di proposito: così questo modulo lo può caricare anche uno
 * script di verifica, senza tirarsi dietro React o gli alias del progetto.
 */

/** Forma minima di una fase: qualunque task la soddisfa. */
export interface FaseProcesso {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  due_date: string | null;
  position: number;
}

/**
 * Ordine del processo: quello in cui le fasi sono state pensate.
 *
 * `position` nasce dall'ordine del template (creazione in sequenza) ed è
 * l'unico che descrive il flusso: ordinare per scadenza mostrerebbe le fasi
 * mescolate ogni volta che qualcuno sposta una data.
 */
export function ordinaFasi<T extends FaseProcesso>(fasi: T[]): T[] {
  return [...fasi].sort(
    (a, b) =>
      a.position - b.position ||
      (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
      a.title.localeCompare(b.title),
  );
}

export interface Avanzamento<T> {
  totale: number;
  fatte: number;
  /** Percentuale intera, per la barra. */
  percento: number;
  /** Fasi ferme in «Problema»: il processo è bloccato lì. */
  bloccate: number;
  /** Prima fase non ancora chiusa: è quella su cui si sta lavorando. */
  corrente: T | null;
}

export function avanzamentoProcesso<T extends FaseProcesso>(
  fasi: T[],
): Avanzamento<T> {
  const ordinate = ordinaFasi(fasi);
  const fatte = ordinate.filter((f) => f.status === "done").length;
  return {
    totale: ordinate.length,
    fatte,
    percento:
      ordinate.length === 0 ? 0 : Math.round((fatte / ordinate.length) * 100),
    bloccate: ordinate.filter((f) => f.status === "alert").length,
    corrente: ordinate.find((f) => f.status !== "done") ?? null,
  };
}
