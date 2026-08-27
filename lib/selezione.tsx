"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * I task selezionati, condivisi fra board ed elenco.
 *
 * Sta in un contesto e non nell'indirizzo, di proposito: una selezione è
 * un gesto in corso, non un posto in cui si è. Metterla nella querystring
 * riempirebbe la cronologia del browser di passaggi che nessuno vuole
 * ripercorrere col tasto indietro.
 *
 * Si svuota da sola cambiando pagina — vedi `PuliziaSelezione` — perché una
 * selezione dimenticata è una trappola: si torna sui task un'ora dopo, si
 * preme «Sposta in Fatto» e si muove roba che non si ricordava di aver
 * scelto.
 */

interface Selezione {
  ids: ReadonlySet<string>;
  commuta: (id: string) => void;
  /** Seleziona un intervallo: usato dallo Shift+clic. */
  aggiungiTutti: (ids: string[]) => void;
  pulisci: () => void;
}

const Contesto = React.createContext<Selezione | null>(null);

/** Un solo insieme vuoto, condiviso: due `new Set()` diversi sembrerebbero
 *  un cambiamento a React e farebbero ridisegnare mezza board per niente. */
const VUOTO: ReadonlySet<string> = new Set();

export function SelezioneProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const percorso = usePathname();

  /* La selezione porta con sé la sezione in cui è nata.

     Cambiando pagina si svuota — una selezione dimenticata è una trappola:
     si torna sui task un'ora dopo, si preme «Sposta in Fatto» e si muove
     roba che non si ricordava di aver scelto.

     Ma si svuota DERIVANDO, non con un effetto che azzera: azzerare in un
     effetto significa disegnare prima la selezione vecchia e poi cancellarla
     — un lampo di schede spuntate su una pagina appena aperta. Tenendo il
     percorso dentro lo stato, una selezione di un'altra sezione semplicemente
     non conta, già al primo disegno. */
  const [stato, setStato] = React.useState<{
    percorso: string;
    ids: ReadonlySet<string>;
  }>(() => ({ percorso, ids: VUOTO }));

  const ids = stato.percorso === percorso ? stato.ids : VUOTO;

  const cambia = React.useCallback(
    (calcola: (precedenti: ReadonlySet<string>) => ReadonlySet<string>) => {
      setStato((prec) => ({
        percorso: window.location.pathname,
        ids: calcola(
          prec.percorso === window.location.pathname ? prec.ids : VUOTO,
        ),
      }));
    },
    [],
  );

  /* Esc annulla la selezione, come chiude i pannelli: è il tasto che si
     preme d'istinto per dire «lascia stare». */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Un pannello aperto ha la precedenza: Esc chiude quello, e la
         selezione resta dov'è. */
      if (document.querySelector('[role="dialog"]')) return;
      cambia((prec) => (prec.size === 0 ? prec : VUOTO));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cambia]);

  const valore = React.useMemo<Selezione>(
    () => ({
      ids,
      commuta: (id) =>
        cambia((prec) => {
          const next = new Set(prec);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      aggiungiTutti: (nuovi) =>
        cambia((prec) => {
          const next = new Set(prec);
          for (const id of nuovi) next.add(id);
          return next;
        }),
      pulisci: () => cambia(() => VUOTO),
    }),
    [ids, cambia],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useSelezione(): Selezione {
  const ctx = React.useContext(Contesto);
  if (!ctx) {
    throw new Error("useSelezione va usato dentro SelezioneProvider");
  }
  return ctx;
}
