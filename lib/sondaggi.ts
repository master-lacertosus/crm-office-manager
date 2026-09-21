/**
 * I sondaggi al team: le domande che si fanno sul sondaggio, tutte qui.
 *
 * Funzioni pure, `adesso` passato da fuori. È la stessa disciplina di
 * `lib/timbrature.ts` e per lo stesso motivo: a chiedersi «questo sondaggio è
 * ancora aperto?» sono quattro punti diversi — il popup, la pastiglia in
 * barra, la pagina, la riga dello storico — e quattro copie della stessa
 * condizione divergono al primo ritocco.
 *
 * COSA QUESTO MODULO NON DECIDE. Non decide chi può chiudere, né se c'è già
 * un sondaggio aperto. Quelle sono regole, e le regole stanno nel database
 * (M19): un controllo in React lo scavalcano due schede aperte. Qui si
 * risponde soltanto a cosa disegnare.
 */

/** Una risposta possibile, col suo conteggio già sommato dal database. */
export interface OpzioneSondaggio {
  id: string;
  testo: string;
  posizione: number;
  /** Quanti l'hanno scelta. Lo tiene un trigger: l'urna non si può leggere. */
  voti: number;
}

/** Una domanda al team. */
export interface Sondaggio {
  id: string;
  autore_id: string;
  domanda: string;
  aperto_at: string;
  scade_at: string;
  /** `null` = aperto. È lo stato, non un dato mancante. */
  chiuso_at: string | null;
  chiuso_da: string | null;
  /** Quante persone attive c'erano al lancio, congelate. */
  aventi_diritto: number;
  voti_totali: number;
  opzioni: OpzioneSondaggio[];
  /** Chi ha votato. Non che cosa: quello non arriva proprio al browser. */
  firme: string[];
  /** La propria scelta, se si è votato. La RLS consegna solo la propria
   *  scheda, quindi questo campo è pieno solo per chi guarda. */
  miaScelta: string | null;
}

/** Quanto dura un sondaggio. Poche scelte, perché sono tutte ragionevoli. */
export const DURATE: { ore: number; etichetta: string }[] = [
  { ore: 1, etichetta: "Un'ora" },
  { ore: 4, etichetta: "Mezza giornata" },
  { ore: 24, etichetta: "Un giorno" },
  { ore: 72, etichetta: "Tre giorni" },
];

export const DURATA_PREDEFINITA = 24;

/**
 * È ancora aperto?
 *
 * Due condizioni, non una: `chiuso_at` lo scrive chi chiude o il lavoro
 * pianificato, ma fra la scadenza e il passaggio successivo di quel lavoro
 * passano fino a cinque minuti. In quei cinque minuti la riga dice ancora
 * «aperto» e non lo è: chiederlo anche all'orologio evita di mostrare un
 * sondaggio scaduto come se accettasse voti.
 */
export function eAperto(s: Sondaggio, adesso: Date): boolean {
  return s.chiuso_at === null && new Date(s.scade_at).getTime() > adesso.getTime();
}

/** Quello aperto, se c'è. Ce n'è al massimo uno: lo impone un indice unico
 *  sul database, non questa funzione. */
export function sondaggioAperto(
  sondaggi: readonly Sondaggio[],
  adesso: Date,
): Sondaggio | null {
  return sondaggi.find((s) => eAperto(s, adesso)) ?? null;
}

/** Ho già votato in questo sondaggio? */
export function hoVotato(s: Sondaggio, ioId: string): boolean {
  return s.firme.includes(ioId);
}

/** Quanti per cento ha preso un'opzione. Zero voti = zero, non NaN. */
export function percentuale(opzione: OpzioneSondaggio, s: Sondaggio): number {
  if (s.voti_totali <= 0) return 0;
  return Math.round((opzione.voti / s.voti_totali) * 100);
}

/**
 * L'opzione (o le opzioni) più votate.
 *
 * Plurale di proposito: un pareggio è un risultato, e dichiarare vincitrice
 * la prima delle due sarebbe una bugia decisa dall'ordine di inserimento.
 */
export function inTesta(s: Sondaggio): OpzioneSondaggio[] {
  const massimo = Math.max(0, ...s.opzioni.map((o) => o.voti));
  if (massimo === 0) return [];
  return s.opzioni.filter((o) => o.voti === massimo);
}

/** Chi non ha ancora votato, fra le persone passate. Con sei persone è la
 *  domanda vera: non «quanti mancano» ma «chi». */
export function chiManca<T extends { id: string; is_active?: boolean }>(
  s: Sondaggio,
  persone: readonly T[],
): T[] {
  return persone.filter(
    (p) => (p.is_active ?? true) && !s.firme.includes(p.id),
  );
}

/** `«2h 15m»`, `«3 giorni»`, `«meno di un minuto»`. Il tempo che resta,
 *  detto come lo direbbe una persona. */
export function tempoRimasto(s: Sondaggio, adesso: Date): string {
  const minuti = Math.floor(
    (new Date(s.scade_at).getTime() - adesso.getTime()) / 60_000,
  );
  if (minuti <= 0) return "scaduto";
  if (minuti < 1) return "meno di un minuto";
  if (minuti < 60) return `${minuti}m`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) {
    const resto = minuti % 60;
    return resto === 0 ? `${ore}h` : `${ore}h ${resto}m`;
  }
  const giorni = Math.round(ore / 24);
  return giorni === 1 ? "un giorno" : `${giorni} giorni`;
}

/**
 * Il sondaggio che deve interrompere, se ce n'è uno.
 *
 * Interrompe solo chi non ha ancora votato: a chi ha già risposto il popup
 * non chiede nulla e sarebbe solo un ostacolo. E chi l'ha chiuso con la X
 * non se lo ritrova addosso al cambio di pagina — ma resta raggiungibile
 * dalla pastiglia in barra, altrimenti chiudere il popup vorrebbe dire
 * rinunciare a votare.
 *
 * Si tengono gli id e non un «l'ho già visto»: chi scarta il sondaggio di
 * oggi deve comunque vedere quello di domani. È lo stesso ragionamento di
 * `lib/assegnazioni.ts`.
 */
export function daInterrompere(
  sondaggi: readonly Sondaggio[],
  ioId: string,
  scartati: readonly string[],
  adesso: Date,
): Sondaggio | null {
  const aperto = sondaggioAperto(sondaggi, adesso);
  if (!aperto) return null;
  if (!ioId) return null;
  if (hoVotato(aperto, ioId)) return null;
  if (scartati.includes(aperto.id)) return null;
  return aperto;
}

/** Perché il pulsante «Lancia» è spento, o `null` se è acceso. Il database
 *  dà comunque l'ultima parola: questo serve solo a non far scrivere venti
 *  righe a qualcuno per poi dirgli di no. */
export function perche(
  domanda: string,
  opzioni: readonly string[],
): string | null {
  if (domanda.trim().length < 3) return "Scrivi la domanda";
  if (domanda.trim().length > 200) return "La domanda è troppo lunga";
  const piene = opzioni.filter((o) => o.trim().length > 0);
  if (piene.length < 2) return "Servono almeno due risposte";
  if (piene.some((o) => o.trim().length > 80)) {
    return "Una risposta è troppo lunga";
  }
  const doppie = new Set(piene.map((o) => o.trim().toLowerCase()));
  if (doppie.size !== piene.length) return "Ci sono due risposte uguali";
  return null;
}
