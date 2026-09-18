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
const DA_RICORDARE = [
  "owner",
  "project",
  "view",
  "stato",
  "q",
  "priority",
  "scadenza",
] as const;

/**
 * Dove si tiene a mente.
 *
 * Era una Map di modulo, e moriva a ogni ricaricamento: bastava un F5, un
 * link aperto da un avviso, o il riavvio del server in sviluppo, e i filtri
 * sparivano — il difetto che l'ufficio ha segnalato come «cambio pagina e
 * torno, e non c'è più niente».
 *
 * `sessionStorage` e non `localStorage`, di proposito: fa esattamente quello
 * che il commento qui sopra prometteva già. Sopravvive al ricaricamento e
 * alla navigazione, muore chiudendo la scheda, e non viaggia fra schede
 * diverse — due finestre aperte su due progetti restano due cose separate,
 * che è come si lavora davvero.
 *
 * La Map resta come copia in memoria: `sessionStorage` può essere negato
 * (finestra anonima, impostazioni restrittive) e in quel caso si torna
 * esattamente al comportamento di prima invece di rompersi.
 */
const CHIAVE = "office-filtri";
const memoria = new Map<string, string>();

/* ------------------------------------------------------------------ */
/* La memoria è uno stato esterno, e React deve poterlo osservare.     */
/*                                                                     */
/* Senza questo pezzo i link della barra laterale restavano indietro   */
/* di un passo: uscendo dai Task con la scorciatoia P, la barra si     */
/* ridisegnava PRIMA che il guardiano annotasse i filtri, e l'indirizzo*/
/* del link «Task» restava nudo per tutta la visita. Il difetto era    */
/* invisibile a chi guardava il codice della memoria — lì funzionava   */
/* tutto — e si vedeva solo cliccando.                                 */
/* ------------------------------------------------------------------ */
let versioneCorrente = 0;
const ascoltatori = new Set<() => void>();

function annuncia(): void {
  versioneCorrente += 1;
  for (const avvisa of ascoltatori) avvisa();
}

/** Si iscrive ai cambiamenti. Per `useSyncExternalStore`. */
export function sottoscrivi(avvisa: () => void): () => void {
  ascoltatori.add(avvisa);
  return () => {
    ascoltatori.delete(avvisa);
  };
}

/** Cambia a ogni annotazione: è l'istantanea che React confronta. */
export function versione(): number {
  return versioneCorrente;
}

/** Sul server non c'è niente da ricordare: è sempre la stessa. */
export function versioneSulServer(): number {
  return 0;
}

/**
 * Riprende quello che si era annotato prima del ricaricamento.
 *
 * Si chiama DOPO il montaggio, non al caricamento del modulo: leggendo
 * `sessionStorage` durante il primo disegno, il browser calcolerebbe link
 * diversi da quelli arrivati dal server e l'idratazione fallirebbe. Così il
 * primo disegno combacia, e i filtri ricompaiono un istante dopo.
 */
export function riprendiDallaSessione(): void {
  if (memoria.size > 0) return;
  const salvato = leggiDaSessione();
  if (salvato.length === 0) return;
  for (const [percorso, filtri] of salvato) memoria.set(percorso, filtri);
  annuncia();
}

function leggiDaSessione(): [string, string][] {
  if (typeof window === "undefined") return [];
  try {
    const grezzo = window.sessionStorage.getItem(CHIAVE);
    if (!grezzo) return [];
    const letto: unknown = JSON.parse(grezzo);
    if (!Array.isArray(letto)) return [];
    return letto.filter(
      (v): v is [string, string] =>
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === "string" &&
        typeof v[1] === "string",
    );
  } catch {
    return [];
  }
}

function salvaNellaSessione(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHIAVE, JSON.stringify([...memoria]));
  } catch {
    /* Spazio finito o scrittura negata: la copia in memoria basta per
       questa visita. Un «riprendi da dove eri» non vale un errore. */
  }
}

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
  salvaNellaSessione();
  annuncia();
}

/** L'indirizzo della sezione, con i suoi ultimi filtri se ce ne sono. */
export function conFiltri(percorso: string): string {
  const filtri = memoria.get(percorso);
  return filtri ? `${percorso}?${filtri}` : percorso;
}

/** Dimentica tutto (usato dalle prove). */
export function dimentica(): void {
  memoria.clear();
  salvaNellaSessione();
  annuncia();
}
