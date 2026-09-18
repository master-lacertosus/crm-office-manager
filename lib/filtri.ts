import { dueUrgency, todayIso } from "@/lib/format";
import { responsabileEffettivo } from "@/lib/filtro-responsabile";
import type { Profile, Task, TaskPriority } from "@/lib/types";

/**
 * Che cosa si sta guardando.
 *
 * La regola «questo task rientra nei filtri» esisteva in quattro copie —
 * board, elenco, calendario, agenda — e tutte e quattro conoscevano solo
 * responsabile e progetto. Aggiungere un criterio voleva dire scriverlo
 * quattro volte e vedere le viste divergere al primo che se ne dimenticava:
 * è la stessa storia dell'ordinamento, risolta in `lib/ordine.ts`.
 *
 * Qui la regola sta in un posto solo, e i criteri diventano sei. Quello che
 * si guadagna non è il filtro in sé: è che una vista salvata può finalmente
 * dire «i miei urgenti in ritardo» invece che soltanto «i miei».
 *
 * I nomi dei parametri li aveva già previsti `lib/memoria-filtri.ts`
 * (`stato`, `q`): si usano quelli, invece di inventarne di nuovi accanto.
 */

/** Finestra di scadenza. `senza` è un criterio, non l'assenza di criterio:
 *  «cosa non ha una data» è una domanda che ci si fa davvero. */
export type FinestraScadenza = "ritardo" | "oggi" | "settimana" | "senza";

export interface FiltriTask {
  /** Già risolto col ruolo: `null` = tutti. Vedi lib/filtro-responsabile. */
  owner: string | null;
  project: string | null;
  priority: TaskPriority | null;
  /** Chiave di fase, comprese quelle personalizzate. */
  stato: string | null;
  scadenza: FinestraScadenza | null;
  /** Ricerca nel titolo e nella descrizione. */
  q: string | null;
}

/** I parametri d'indirizzo che descrivono i filtri (non `view`, che è il
 *  come, non il cosa; non `task`, che è il pannello aperto). */
export const CHIAVI_FILTRO = [
  "owner",
  "project",
  "priority",
  "stato",
  "scadenza",
  "q",
] as const;

const PRIORITA_VALIDE: TaskPriority[] = ["low", "normal", "high"];
const FINESTRE_VALIDE: FinestraScadenza[] = [
  "ritardo",
  "oggi",
  "settimana",
  "senza",
];

/** Un valore arrivato dall'indirizzo vale solo se è uno di quelli previsti:
 *  `?priority=banana` deve sparire, non svuotare la board. */
function seTra<T extends string>(valore: string | null, ammessi: T[]): T | null {
  return valore && (ammessi as string[]).includes(valore)
    ? (valore as T)
    : null;
}

/** Legge i filtri dall'indirizzo, risolvendo il responsabile col ruolo. */
export function leggiFiltri(
  params: URLSearchParams,
  utente: Pick<Profile, "id" | "role">,
): FiltriTask {
  const q = params.get("q")?.trim();
  return {
    owner: responsabileEffettivo(params.get("owner"), utente),
    project: params.get("project") || null,
    priority: seTra(params.get("priority"), PRIORITA_VALIDE),
    stato: params.get("stato") || null,
    scadenza: seTra(params.get("scadenza"), FINESTRE_VALIDE),
    q: q ? q : null,
  };
}

/** La scadenza cade nella finestra chiesta? */
function scadenzaRientra(task: Task, finestra: FinestraScadenza): boolean {
  if (finestra === "senza") return !task.due_date;
  if (!task.due_date) return false;
  const { level, days } = dueUrgency(task.due_date);
  if (finestra === "ritardo") return level === "overdue";
  if (finestra === "oggi") return level === "today";
  /* «Questa settimana» = da oggi a sette giorni, e ci si mette dentro anche
     l'arretrato: chi chiede cosa c'è da consegnare non vuole scoprire dopo
     che c'era anche un lavoro scaduto ieri. */
  return level === "overdue" || days <= 7;
}

/** Il task passa tutti i filtri? L'archivio resta sempre fuori: ha la sua
 *  pagina, e mescolarlo al lavoro corrente è la ragione per cui esiste. */
export function passaFiltri(task: Task, f: FiltriTask): boolean {
  if (task.archived_at) return false;
  if (f.owner && task.owner_id !== f.owner) return false;
  if (f.project && task.project_id !== f.project) return false;
  if (f.priority && task.priority !== f.priority) return false;
  if (f.stato && task.status !== f.stato) return false;
  if (f.scadenza && !scadenzaRientra(task, f.scadenza)) return false;
  if (f.q) {
    const ago = f.q.toLocaleLowerCase("it");
    const pagliaio = `${task.title} ${task.description ?? ""}`.toLocaleLowerCase(
      "it",
    );
    if (!pagliaio.includes(ago)) return false;
  }
  return true;
}

/** I task che rientrano, nell'ordine in cui sono arrivati. */
export function applicaFiltri(tasks: readonly Task[], f: FiltriTask): Task[] {
  return tasks.filter((t) => passaFiltri(t, f));
}

/**
 * Quanti criteri «avanzati» sono accesi.
 *
 * Responsabile e progetto non si contano: hanno il loro menu sempre in
 * vista, e chi li ha impostati lo sta già leggendo lì. Il numero serve a
 * dire che dietro il pulsante «Filtri» c'è qualcosa di acceso che altrimenti
 * non si vedrebbe — un filtro invisibile che nasconde metà della board è il
 * modo più veloce per far credere che i dati siano spariti.
 */
export function quantiFiltriAvanzati(f: FiltriTask): number {
  let n = 0;
  if (f.priority) n += 1;
  if (f.stato) n += 1;
  if (f.scadenza) n += 1;
  if (f.q) n += 1;
  return n;
}

/** Etichette leggibili, per i menu e per il riassunto di una vista. */
export const ETICHETTE_PRIORITA: Record<TaskPriority, string> = {
  high: "Alta",
  normal: "Normale",
  low: "Bassa",
};

export const ETICHETTE_SCADENZA: Record<FinestraScadenza, string> = {
  ritardo: "In ritardo",
  oggi: "Scade oggi",
  settimana: "Entro 7 giorni",
  senza: "Senza scadenza",
};

/** Oggi, come lo vede il filtro: esposto perché le prove possano dire
 *  «rispetto a quale giorno» senza reimplementare il calendario. */
export const oggiPerFiltri = todayIso;
