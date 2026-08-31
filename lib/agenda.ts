import { confrontaPerScadenza } from "@/lib/ordine";
import type { Task } from "@/lib/types";

/**
 * L'agenda: cosa c'è da fare, giorno per giorno.
 *
 * Board ed Elenco rispondono a «a che punto è il lavoro». L'agenda risponde
 * a un'altra domanda, che è quella che ci si fa il lunedì mattina e il
 * venerdì sera: **cosa devo consegnare, e quando**. Per rispondere serve
 * poter guardare avanti — i Report non lo permettono, e non per una svista:
 * misurano `completed_at`, quindi sono retrospettivi per costruzione e un
 * intervallo futuro darebbe pagine vuote.
 *
 * Qui si guarda invece la scadenza, e l'intervallo è libero: indietro per
 * rivedere cosa è stato consegnato, avanti per sapere cosa arriva.
 */

export interface GiornoAgenda {
  giorno: string;
  lavori: Task[];
}

export interface Agenda {
  /** Scaduti e non chiusi, rimasti fuori dall'intervallo a sinistra.
   *  Guardare la settimana prossima senza vedere cosa ci si trascina
   *  dietro darebbe una tranquillità falsa. */
  arretrati: Task[];
  giorni: GiornoAgenda[];
  /** Senza una data non stanno in nessun giorno: sparirebbero e basta. */
  senzaData: Task[];
  totale: number;
}

export function costruisciAgenda(
  tasks: Task[],
  {
    da,
    a,
    includiCompletate = false,
    includiSenzaData = false,
    oggi,
  }: {
    da: string;
    a: string;
    includiCompletate?: boolean;
    includiSenzaData?: boolean;
    oggi: string;
  },
): Agenda {
  /* L'intervallo al contrario capita: si sposta «dal» oltre «al» mentre si
     compila. Meglio leggerlo come l'utente lo intendeva che restituire il
     vuoto. */
  const [inizio, fine] = da <= a ? [da, a] : [a, da];

  const vivi = tasks.filter((t) => {
    if (t.archived_at) return false;
    if (!includiCompletate && t.status === "done") return false;
    return true;
  });

  /* Arretrati: scaduti rispetto a OGGI e fuori dall'intervallo a sinistra.
     Se l'intervallo li comprende già, compaiono nel loro giorno e qui
     sarebbero un doppione. */
  const arretrati = vivi
    .filter(
      (t) =>
        t.status !== "done" &&
        t.due_date !== null &&
        t.due_date < oggi &&
        t.due_date < inizio,
    )
    .sort(confrontaPerScadenza);

  const dentro = vivi.filter(
    (t) => t.due_date !== null && t.due_date >= inizio && t.due_date <= fine,
  );

  const perGiorno = new Map<string, Task[]>();
  for (const t of dentro) {
    const g = t.due_date!;
    const elenco = perGiorno.get(g);
    if (elenco) elenco.push(t);
    else perGiorno.set(g, [t]);
  }

  const giorni: GiornoAgenda[] = [...perGiorno.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([giorno, lavori]) => ({
      giorno,
      /* Stesso giorno per tutti: l'ordine cade sulla posizione, cioe' la
         stessa regola di board ed elenco. Un'agenda che ordinasse a modo
         suo sarebbe la sesta copia del problema appena risolto. */
      lavori: [...lavori].sort(confrontaPerScadenza),
    }));

  const senzaData = includiSenzaData
    ? vivi.filter((t) => t.due_date === null).sort(confrontaPerScadenza)
    : [];

  return {
    arretrati,
    giorni,
    senzaData,
    totale:
      arretrati.length +
      giorni.reduce((n, g) => n + g.lavori.length, 0) +
      senzaData.length,
  };
}

/** Gli intervalli pronti. Il primo che serve davvero è «oggi». */
export const INTERVALLI = [
  { chiave: "oggi", etichetta: "Oggi", giorniAvanti: 0 },
  { chiave: "7", etichetta: "Prossimi 7 giorni", giorniAvanti: 6 },
  { chiave: "30", etichetta: "Prossimi 30 giorni", giorniAvanti: 29 },
] as const;

export type ChiaveIntervallo = (typeof INTERVALLI)[number]["chiave"] | "custom";
