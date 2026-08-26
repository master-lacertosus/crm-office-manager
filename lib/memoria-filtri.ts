"use client";

/**
 * I filtri di una sezione sopravvivono al cambio pagina.
 *
 * Filtri e tipo di vista vivono nella querystring — `?owner=…&project=…` —
 * ed è la scelta giusta: l'indirizzo descrive cosa si sta guardando, si può
 * mandare a un collega, il tasto «indietro» funziona.
 *
 * Ma i link della barra laterale sono indirizzi nudi: `/tasks`. Filtrare i
 * task per progetto, andare in Calendario e tornare indietro riportava
 * l'elenco completo, e ogni volta bisognava rimettere gli stessi filtri.
 * Su una board di lavoro vera è un gesto che si ripete venti volte al
 * giorno.
 *
 * Qui si tiene a mente l'ultima querystring di ogni sezione e si riattacca
 * al link. Sta in memoria e non su disco, di proposito: è un comodo
 * «riprendi da dove eri», non una preferenza da portarsi dietro per sempre.
 * Chiudendo la scheda si riparte puliti, che è quello che ci si aspetta.
 */

/** Solo i parametri che descrivono COSA si guarda. `task` e `tv` no: sono
 *  il pannello aperto in quel momento, e riaprirlo tornando da un'altra
 *  pagina sarebbe una sorpresa, non una comodità. */
const DA_RICORDARE = ["owner", "project", "view", "stato", "q"] as const;

const memoria = new Map<string, string>();

/** Estrae dalla querystring i soli parametri di vista. */
export function filtriDi(search: string): string {
  const dentro = new URLSearchParams(search);
  const fuori = new URLSearchParams();
  for (const chiave of DA_RICORDARE) {
    const valore = dentro.get(chiave);
    if (valore) fuori.set(chiave, valore);
  }
  return fuori.toString();
}

/** Annota i filtri correnti della sezione. */
export function ricorda(percorso: string, search: string): void {
  const filtri = filtriDi(search);
  if (filtri) memoria.set(percorso, filtri);
  else memoria.delete(percorso);
}

/** L'indirizzo della sezione, con i suoi ultimi filtri se ce ne sono. */
export function conFiltri(percorso: string): string {
  const filtri = memoria.get(percorso);
  return filtri ? `${percorso}?${filtri}` : percorso;
}

/** Dimentica tutto (usato dalle prove). */
export function dimentica(): void {
  memoria.clear();
}
