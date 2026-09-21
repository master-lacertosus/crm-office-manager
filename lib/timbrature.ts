import { giornoLocale } from "@/lib/format";

/**
 * Quante ore ho fatto.
 *
 * Il conto sta qui, in un posto solo, perché a chiederselo sono tre punti
 * diversi (la pastiglia in barra, il blocco della dashboard, il totale del
 * mese) e tre copie della stessa aritmetica divergono al primo ritocco — è
 * già successo su questo repo con l'ordinamento e con i filtri.
 *
 * COSA QUESTO MODULO NON FA, DI PROPOSITO.
 * Non calcola un «dovuto» e non calcola un «saldo». Sembrano il naturale
 * passo successivo e invece sono il punto in cui il conto diventa falso, per
 * tre ragioni che il codice da solo non può risolvere:
 *
 *   - i festivi infrasettimanali non esistono in questo prodotto
 *     (`workingDaysCount` esclude solo weekend e chiusure inserite a mano),
 *     quindi ogni 25 aprile toglierebbe otto ore a tutti;
 *   - un permesso a ore ha un orario scritto a mano in testo libero
 *     (`time_range`, «9:00-13:00»), che non si può contare;
 *   - «straordinario» è una parola con un significato contrattuale, e
 *     stamparla accanto a un numero dedotto sarebbe un'affermazione che
 *     questo strumento non è in grado di sostenere.
 *
 * Qui si contano le ore fatte, e basta. È quello che serve per rispondere
 * alla domanda che è stata posta — «com'è andato il mese» — e non promette
 * niente di più.
 */

/** Una giornata timbrata. Una riga per giorno, non una per timbratura. */
export interface Giornata {
  id: string;
  /** `YYYY-MM-DD` locale. */
  giorno: string;
  /** ISO datetime dell'entrata. */
  entrata: string;
  /** ISO datetime dell'uscita, o `null` se si sta ancora lavorando. */
  uscita: string | null;
  /** Minuti tolti per la pausa. */
  pausa_minuti: number;
  /** La pausa viene da un uscita e un rientro veri (M18), o e ancora l ora
   *  presunta? Al primo rientro la presunta si sostituisce, ai successivi si
   *  somma: senza distinguerle si conterebbe la pausa due volte. */
  pausa_misurata: boolean;
  /** Quando è stata corretta a mano, se è successo. */
  corretta_at: string | null;
}

/**
 * La pausa che si scala quando non si dice altro.
 *
 * L'ufficio lavora 8:30-17:30 con un'ora di pausa. Timbrare quattro volte al
 * giorno — entrata, pranzo, rientro, uscita — darebbe il minuto esatto, e
 * sarebbe il modulo da compilare che questo prodotto rifiuta per principio;
 * e chi dimentica il rientro falsa la giornata più di quanto la falsi
 * un'ora fissa.
 *
 * Il patto è dichiarato, non nascosto: due gesti al giorno, un'ora tolta. Chi
 * salta il pranzo per lavorare perde quell'ora nel conto, e l'interfaccia lo
 * dice invece di far finta di niente.
 */
export const PAUSA_PREDEFINITA_MINUTI = 60;

/** L'orario classico dell'ufficio, per le etichette. Non è una regola di
 *  calcolo: nessuno viene misurato rispetto a questo. */
export const ORARIO_UFFICIO = {
  entrata: "8:30",
  uscita: "17:30",
  pausaMinuti: PAUSA_PREDEFINITA_MINUTI,
} as const;

/**
 * I minuti lavorati in una giornata.
 *
 * Se manca l'uscita si conta fino a `adesso`: è il caso della pastiglia in
 * barra, che deve dire «stai lavorando da 3h12» mentre la giornata è ancora
 * aperta. `adesso` si passa da fuori e non si legge qui dentro, così la
 * funzione resta pura e provabile.
 */
export function minutiLavorati(g: Giornata, adesso: Date): number {
  const inizio = new Date(g.entrata).getTime();
  const fine = g.uscita ? new Date(g.uscita).getTime() : adesso.getTime();
  const lordi = Math.floor((fine - inizio) / 60_000);
  if (lordi <= 0) return 0;
  /* La pausa si scala solo se la giornata è abbastanza lunga da averla
     contenuta: togliere un'ora a chi è passato in ufficio quaranta minuti
     darebbe un numero negativo, e un numero negativo non significa niente. */
  const netti = lordi - (lordi > g.pausa_minuti ? g.pausa_minuti : 0);
  return Math.max(0, netti);
}

/** `312` → `«5h 12m»`. Il formato che si legge a colpo d'occhio. */
export function inOre(minuti: number): string {
  const ore = Math.floor(minuti / 60);
  const min = minuti % 60;
  if (ore === 0) return `${min}m`;
  if (min === 0) return `${ore}h`;
  return `${ore}h ${String(min).padStart(2, "0")}m`;
}

/** I minuti di un insieme di giornate. */
export function totaleMinuti(
  giornate: readonly Giornata[],
  adesso: Date,
): number {
  return giornate.reduce((somma, g) => somma + minutiLavorati(g, adesso), 0);
}

/** La giornata ancora aperta, se ce n'è una. Ce n'è al massimo una: lo
 *  impone un indice unico sul database. */
export function giornataAperta(
  giornate: readonly Giornata[],
): Giornata | null {
  return giornate.find((g) => !g.uscita) ?? null;
}

/** La giornata di oggi, aperta o chiusa che sia. */
export function giornataDiOggi(
  giornate: readonly Giornata[],
  adesso: Date,
): Giornata | null {
  const oggi = giornoLocale(adesso.toISOString());
  return giornate.find((g) => g.giorno === oggi) ?? null;
}

/**
 * Le giornate di un intervallo, dalla più recente.
 *
 * `da` e `a` sono giorni locali inclusi (`YYYY-MM-DD`), cioè la stessa forma
 * con cui il resto del prodotto tratta le date senza orario.
 */
export function giornateTra(
  giornate: readonly Giornata[],
  da: string,
  a: string,
): Giornata[] {
  return giornate
    .filter((g) => g.giorno >= da && g.giorno <= a)
    .sort((x, y) => y.giorno.localeCompare(x.giorno));
}

/** Il lunedì della settimana di `giorno` (`YYYY-MM-DD`). La settimana qui
 *  comincia di lunedì, come nel calendario del prodotto. */
export function lunediDi(giorno: string): string {
  const [y, m, d] = giorno.split("-").map(Number);
  const data = new Date(y, m - 1, d);
  const scarto = (data.getDay() + 6) % 7;
  data.setDate(data.getDate() - scarto);
  return giornoLocale(data.toISOString());
}

/** Il primo del mese di `giorno`. */
export function primoDelMeseDi(giorno: string): string {
  return `${giorno.slice(0, 7)}-01`;
}

/**
 * Le ore che stanno oltre l'orario classico, giorno per giorno.
 *
 * Si chiama «oltre l'orario» e non «straordinario» di proposito: è una
 * differenza aritmetica su una singola giornata, non un istituto
 * contrattuale. Dice «quel martedì sei rimasto due ore in più», che è un
 * fatto; non dice che quelle due ore ti spettano, che è un'altra cosa e non
 * la decide un CRM.
 */
export function minutiOltreOrario(g: Giornata, adesso: Date): number {
  const giornataPiena = 8 * 60;
  return Math.max(0, minutiLavorati(g, adesso) - giornataPiena);
}
