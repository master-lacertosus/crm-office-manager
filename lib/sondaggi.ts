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
  /** Le risposte si firmano? (M21) Lo decide chi lancia, domanda per domanda:
   *  «pizza o sushi» resta anonimo, «chi copre il turno di sabato» e inutile
   *  se non si sa chi. Il valore di serie e false -- un impostazione che
   *  protegge le persone non si mette dietro una spunta da ricordarsi. */
  palese: boolean;
  voti_totali: number;
  opzioni: OpzioneSondaggio[];
  /** Chi ha votato. Non che cosa: quello non arriva proprio al browser. */
  firme: string[];
  /** La propria scelta, se si è votato. */
  miaScelta: string | null;
  /** Chi ha scelto cosa. Pieno SOLO nei sondaggi firmati: in quelli anonimi
   *  la RLS consegna al massimo la propria riga — non è l'interfaccia a
   *  nasconderlo, è il database a non mandarlo. */
  scelte: { profile_id: string; opzione_id: string }[];
}

/** Chi ha scelto questa risposta, in un sondaggio firmato. Vuoto in uno
 *  anonimo, perché lì le righe degli altri non arrivano. */
export function chiHaScelto(s: Sondaggio, opzioneId: string): string[] {
  if (!s.palese) return [];
  return s.scelte
    .filter((sc) => sc.opzione_id === opzioneId)
    .map((sc) => sc.profile_id);
}

/*
 * Quando si chiude: un momento scelto, non un intervallo di ore.
 *
 * Un sondaggio si chiude quando serve la risposta — prima della riunione di
 * giovedì, entro stasera — non dopo un numero tondo di ore. Con le durate a
 * scelta fissa, alle 15:23 «entro stasera» non si poteva dire: si sceglieva
 * «un giorno» e il sondaggio scadeva domani alle 15:23, che non è una
 * scadenza, è un caso.
 */

/** `Date` → `2026-09-23T17:30`, il formato che vuole `datetime-local`. */
export function perIlCampo(quando: Date): string {
  const due = (n: number) => String(n).padStart(2, "0");
  return (
    `${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())}` +
    `T${due(quando.getHours())}:${due(quando.getMinutes())}`
  );
}

/**
 * La scadenza proposta: domani alla fine dell'orario d'ufficio.
 *
 * Non «fra ventiquattro ore». Le 17:30 sono il momento in cui questo ufficio
 * smette, quindi sono l'ultimo istante in cui una risposta serve ancora a
 * qualcosa. Sempre domani e mai oggi: una proposta che scade fra due ore
 * costringerebbe a correggerla ogni volta.
 */
export function scadenzaPredefinita(adesso: Date): string {
  const domani = new Date(adesso);
  domani.setDate(domani.getDate() + 1);
  domani.setHours(17, 30, 0, 0);
  return perIlCampo(domani);
}

/** Il primo momento accettabile, per il `min` del campo: un quarto d'ora,
 *  come pretende il database. Prima di allora nessuno fa in tempo a
 *  rispondere, e un sondaggio già scaduto bloccherebbe il prossimo. */
export function scadenzaMinima(adesso: Date): string {
  return perIlCampo(new Date(adesso.getTime() + 15 * 60_000));
}

/** E l'ultimo: due settimane. Oltre, un sondaggio non se lo ricorda più
 *  nessuno. */
export function scadenzaMassima(adesso: Date): string {
  return perIlCampo(new Date(adesso.getTime() + 14 * 24 * 60 * 60_000));
}

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
  scadeAt: string,
  adesso: Date,
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

  /* La scadenza si controlla anche qui e non solo sul database: far scrivere
     una domanda e sei risposte per poi sentirsi dire di no è uno scherzo. Il
     database resta l'ultima parola — fra questo controllo e il clic passa del
     tempo, e un quarto d'ora può essersi consumato. */
  const quando = new Date(scadeAt);
  if (!scadeAt || Number.isNaN(quando.getTime())) {
    return "Scegli quando si chiude";
  }
  if (quando.getTime() < adesso.getTime() + 15 * 60_000) {
    return "La scadenza dev'essere almeno fra un quarto d'ora";
  }
  if (quando.getTime() > adesso.getTime() + 14 * 24 * 60 * 60_000) {
    return "Due settimane sono il massimo";
  }
  return null;
}
