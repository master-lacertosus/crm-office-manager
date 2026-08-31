/**
 * Il pezzo scritto ma non ancora aggiunto non si butta via.
 *
 * Il riquadro «Pezzi di questo lavoro» tiene una riga di bozza: si scrive
 * il titolo, si sceglie chi se ne occupa, e il pezzo entra nell'elenco solo
 * premendo Invio o il «+». Chi invece compilava quella riga e cliccava
 * «Crea task» — cioè il gesto che conclude tutto il resto del modulo —
 * si vedeva scartare il pezzo senza un avviso.
 *
 * Non era un caso raro: in tutta la vita del prodotto nessun pezzo è mai
 * nato insieme al suo lavoro, mentre nove sono stati aggiunti dopo, a mano.
 * La funzione serviva; era il gesto per confermarla a non arrivare mai.
 *
 * Il modulo non ha bisogno di essere insegnato: se al momento del
 * salvataggio c'è una bozza con un titolo, vale come un pezzo.
 */

export interface PezzoNuovo {
  /** Chiave locale: serve solo a React finché non esiste una riga vera. */
  chiave: string;
  titolo: string;
  owner_id: string;
}

/** La riga in compilazione, prima che diventi un pezzo. */
export interface BozzaPezzo {
  titolo: string;
  owner_id: string;
}

export const BOZZA_VUOTA: BozzaPezzo = { titolo: "", owner_id: "" };

/**
 * I pezzi da creare davvero: quelli confermati più la bozza, se ha un
 * titolo. `chiave` la mette chi chiama, perché generarla qui renderebbe
 * la funzione impossibile da provare.
 */
export function pezziDaSalvare(
  pezzi: PezzoNuovo[],
  bozza: BozzaPezzo,
  chiavePerLaBozza: string,
  /* Chi se ne occupa se il menu non è stato toccato: la bozza nasce senza
     responsabile, e un pezzo senza responsabile il database lo rifiuta. */
  responsabilePredefinito: string,
): PezzoNuovo[] {
  const titolo = bozza.titolo.trim();
  if (!titolo) return pezzi;

  /* Se la bozza ripete un pezzo già in elenco non si aggiunge due volte:
     capita a chi, per sicurezza, riscrive quello che ha appena inserito. */
  const giaPresente = pezzi.some(
    (p) => p.titolo.trim().toLowerCase() === titolo.toLowerCase(),
  );
  if (giaPresente) return pezzi;

  return [
    ...pezzi,
    {
      chiave: chiavePerLaBozza,
      titolo,
      owner_id: bozza.owner_id || responsabilePredefinito,
    },
  ];
}
