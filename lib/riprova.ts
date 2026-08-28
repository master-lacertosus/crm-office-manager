/**
 * Una richiesta che non parte non è un salvataggio rifiutato.
 *
 * Sono due eventi diversi e li trattavamo uguali: si buttava via il lavoro
 * e si mostrava «Modifica non salvata». Ma il database non ha detto di no —
 * non ha detto niente, perché la domanda non gli è arrivata.
 *
 * Su Safari il messaggio è «Load failed», su Chrome «Failed to fetch»: in
 * entrambi i casi è la connessione che ha singhiozzato. Capita sul wifi
 * dell'ufficio, capita al telefono che passa da una cella all'altra, e
 * capita di più a chi lavora dal portatile in giro. Chiedere di riscrivere
 * il task per un decimo di secondo di rete è inaccettabile: si riprova, e
 * quasi sempre la seconda volta passa.
 *
 * Un rifiuto del database invece NON si riprova: se la policy dice di no,
 * dirà di no anche fra due secondi, e insistere ritarderebbe soltanto il
 * momento in cui l'utente lo scopre.
 */

/** Un errore di trasporto: la richiesta non è arrivata a destinazione. */
export function eProblemaDiRete(errore: unknown): boolean {
  /* Si riconosce dal testo, non dal tipo. Un `fetch` fallito lancia un
     TypeError — ma lo lancia anche `undefined.qualcosa`, e prendere tutti
     i TypeError per problemi di rete significherebbe mostrare «controlla
     la connessione» a chi ha invece trovato un bug nostro, riprovando tre
     volte una cosa che non funzionerà mai. I browser sono pochi e le loro
     parole sono note: meglio elencarle che indovinare. */
  if (errore && typeof errore === "object") {
    const e = errore as { message?: unknown; code?: unknown; name?: unknown };

    /* Gli errori di PostgREST portano sempre un codice: se c'è, il database
       ha risposto, e la sua risposta è un no. */
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) {
      return false;
    }

    const testo = `${typeof e.name === "string" ? e.name : ""} ${
      typeof e.message === "string" ? e.message : ""
    }`.toLowerCase();

    return (
      testo.includes("load failed") ||
      testo.includes("failed to fetch") ||
      testo.includes("networkerror") ||
      testo.includes("network request failed") ||
      testo.includes("connection") ||
      testo.includes("timeout") ||
      testo.includes("aborted")
    );
  }

  return false;
}

/**
 * Il secondo tentativo di un inserimento già andato a buon fine.
 *
 * Se la prima richiesta era arrivata al database ma la risposta si è persa
 * per strada, il ritentativo trova la riga già lì e il database risponde
 * «chiave duplicata». Non è un errore: è la prova che la prima volta era
 * andata bene. Tutte le nostre scritture usano un id generato dal browser,
 * quindi ripeterle è innocuo — ed è proprio questo che rende sicuro
 * riprovare.
 */
function eGiaFatto(errore: unknown): boolean {
  return (
    !!errore &&
    typeof errore === "object" &&
    (errore as { code?: unknown }).code === "23505"
  );
}

const attesa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Esegue l'operazione, riprovando solo se è la rete ad aver ceduto.
 *
 * Le pause crescono — 300ms, 900ms — perché un secondo tentativo immediato
 * cade nello stesso buco del primo. Tre tentativi in tutto: oltre, non è
 * più un singhiozzo, ed è meglio dirlo che continuare a girare in silenzio.
 */
export async function conRitentativi<T>(
  operazione: () => Promise<T>,
  {
    tentativi = 3,
    pause = [300, 900],
    dormi = attesa,
  }: {
    tentativi?: number;
    pause?: number[];
    /** Sostituibile nelle prove, per non aspettare davvero. */
    dormi?: (ms: number) => Promise<unknown>;
  } = {},
): Promise<T> {
  let ultimo: unknown;

  for (let i = 0; i < tentativi; i++) {
    try {
      return await operazione();
    } catch (e) {
      /* Il ritentativo ha trovato la riga già scritta: la prima volta era
         andata a buon fine e si è persa solo la risposta. */
      if (i > 0 && eGiaFatto(e)) return undefined as T;

      ultimo = e;
      /* Un no del database è un no: insistere ritarderebbe soltanto il
         momento in cui l'utente lo scopre. */
      if (!eProblemaDiRete(e)) throw e;
      if (i === tentativi - 1) break;
      await dormi(pause[Math.min(i, pause.length - 1)]);
    }
  }

  throw ultimo;
}
