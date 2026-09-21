"use client";

import * as React from "react";

import { ChartTip, type TipState } from "@/components/charts/chart-tip";
import { inOre } from "@/lib/timbrature";

/** Una colonna del grafico: un giorno del mese. */
export interface GiornoDelMese {
  /** `YYYY-MM-DD`. */
  giorno: string;
  /** Numero del giorno, per l'asse. */
  numero: number;
  minuti: number;
  weekend: boolean;
  oggi: boolean;
}

const ALTEZZA = 168;
const PAD = { top: 12, right: 4, bottom: 20, left: 30 };

/* La giornata piena: la riga tratteggiata contro cui si legge tutto il resto.
   Senza un riferimento, «7h 40m» e «8h 20m» sono due numeri qualunque; con
   la riga diventano «poco sotto» e «poco sopra», che è la domanda vera. */
const GIORNATA_MINUTI = 8 * 60;

/* Due soli colori, e presi dai token invece che scritti a mano.
   Non è pignoleria: il tema scuro di questo prodotto è vero (`--card` diventa
   #191e27), e un grafite fisso #3E434B su quel fondo è una barra che non si
   vede. `fill-ink-secondary` vale #475569 di giorno e #b3bccd di notte — la
   stessa gerarchia, ribaltata insieme alla stanza.

   Il secondo è `warning`, lo stesso ambra con cui il prodotto dice già
   «guarda qui»: così la parte oltre le otto ore nel grafico e la pastiglia
   «+1h 20m» nella tabella sono la stessa cosa detta due volte, invece di due
   arancioni che litigano.

   Passate entrambe dal validatore (`scripts/validate_palette.js`), su fondo
   chiaro e su fondo scuro. I controlli che decidono se due serie si
   distinguono passano larghi: separazione per daltonismo ΔE 32,2 di giorno e
   16,8 di notte, contro una soglia di 8; visione normale 38,1 e 17,2, contro
   15. Restano fuori due controlli, e per lo stesso motivo di sempre: il
   grigio di prodotto ha croma quasi nulla (è l'inchiostro, non una tinta), e
   l'ambra chiara sta a 2,09:1 sul bianco. Il secondo il metodo lo consente
   solo se il colore non è l'unica cosa che parla — e infatti non lo è:
   legenda, pastiglia «+1h 20m» scritta accanto a ogni giornata lunga nella
   tabella qui sotto, e la tabella `sr-only` in fondo a questo file. */
const SERIE_ENTRO = "fill-ink-secondary";
const SERIE_OLTRE = "fill-warning";

/**
 * Le ore di ogni giorno del mese.
 *
 * Barre e non una linea, perché i giorni sono discreti e parecchi sono
 * vuoti: una linea che attraversa il sabato disegnerebbe un lavoro che non
 * c'è stato. Le colonne vuote restano vuote, ed è un'informazione.
 *
 * La parte oltre le otto ore è ambra, così una giornata lunga si vede da
 * lontano senza dover leggere un numero. Sotto, l'asse dice solo i lunedì:
 * trentuno etichette sarebbero rumore, e la settimana è il ritmo con cui si
 * guarda un mese.
 */
export function OreDelMese({ giorni }: { giorni: GiornoDelMese[] }) {
  const contenitoreRef = React.useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = React.useState(0);
  const [tip, setTip] = React.useState<TipState | null>(null);

  React.useEffect(() => {
    const el = contenitoreRef.current;
    if (!el) return;
    const osservatore = new ResizeObserver(([voce]) =>
      setLarghezza(voce.contentRect.width),
    );
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  const innerW = Math.max(0, larghezza - PAD.left - PAD.right);
  const innerH = ALTEZZA - PAD.top - PAD.bottom;

  /* La scala arriva sempre almeno a nove ore: se il tetto seguisse il massimo
     del mese, un mese tranquillo disegnerebbe colonne altissime e sembrerebbe
     un mese pieno. Il riferimento deve restare confrontabile fra mesi. */
  const maxMinuti = Math.max(
    GIORNATA_MINUTI * 1.125,
    ...giorni.map((g) => g.minuti),
  );

  const passo = giorni.length > 0 ? innerW / giorni.length : 0;
  /* Gap di 2px fra le colonne, come il resto dei grafici del prodotto. */
  const larghezzaBarra = Math.max(3, Math.min(18, passo - 2));
  const yDi = (minuti: number) =>
    PAD.top + innerH - (minuti / maxMinuti) * innerH;
  const yRiferimento = yDi(GIORNATA_MINUTI);

  if (giorni.length === 0) return null;

  return (
    <div>
      <div ref={contenitoreRef} className="relative">
        {larghezza > 0 ? (
          <svg
            width={larghezza}
            height={ALTEZZA}
            role="img"
            aria-label="Ore lavorate giorno per giorno"
            onPointerLeave={() => setTip(null)}
          >
            {/* Griglia recessiva: solo due tacche, a 4 e 8 ore. Una griglia
                fitta competerebbe con le colonne che dovrebbe aiutare. */}
            {[GIORNATA_MINUTI / 2, GIORNATA_MINUTI].map((m) => (
              <line
                key={m}
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={yDi(m)}
                y2={yDi(m)}
                className="stroke-border-soft"
                strokeWidth={1}
                strokeDasharray={m === GIORNATA_MINUTI ? "4 4" : undefined}
              />
            ))}
            <text
              x={PAD.left - 6}
              y={yRiferimento + 3}
              textAnchor="end"
              className="fill-ink-muted font-mono text-[10px]"
            >
              8h
            </text>
            <text
              x={PAD.left - 6}
              y={yDi(GIORNATA_MINUTI / 2) + 3}
              textAnchor="end"
              className="fill-ink-faint font-mono text-[10px]"
            >
              4h
            </text>

            {giorni.map((g, i) => {
              const x = PAD.left + i * passo + (passo - larghezzaBarra) / 2;
              const dentro = Math.min(g.minuti, GIORNATA_MINUTI);
              const fuori = Math.max(0, g.minuti - GIORNATA_MINUTI);
              const yDentro = yDi(dentro);
              const yFuori = yDi(g.minuti);

              return (
                <g
                  key={g.giorno}
                  onPointerEnter={() =>
                    setTip({
                      x: x + larghezzaBarra / 2,
                      y: yDi(g.minuti),
                      title: `${g.numero}${g.oggi ? " (oggi)" : ""}`,
                      value: g.minuti > 0 ? inOre(g.minuti) : "niente",
                    })
                  }
                >
                  {/* Bersaglio del mouse a tutta altezza: una colonna da tre
                      pixel sarebbe impossibile da centrare. */}
                  <rect
                    x={PAD.left + i * passo}
                    y={PAD.top}
                    width={Math.max(passo, 1)}
                    height={innerH}
                    fill="transparent"
                  />
                  {/* Il weekend resta disegnato ma quasi invisibile: dice «qui
                      non ci si aspettava niente», che non è lo stesso di un
                      giorno feriale vuoto. */}
                  {g.minuti === 0 ? (
                    <rect
                      x={x}
                      y={PAD.top + innerH - 2}
                      width={larghezzaBarra}
                      height={2}
                      rx={1}
                      className={g.weekend ? "fill-border" : "fill-input"}
                    />
                  ) : (
                    <>
                      <rect
                        x={x}
                        y={yDentro}
                        width={larghezzaBarra}
                        height={Math.max(0, PAD.top + innerH - yDentro)}
                        rx={3}
                        className={SERIE_ENTRO}
                        opacity={g.weekend ? 0.55 : 1}
                      />
                      {fuori > 0 ? (
                        <rect
                          x={x}
                          y={yFuori}
                          width={larghezzaBarra}
                          height={Math.max(0, yDentro - yFuori - 2)}
                          rx={3}
                          className={SERIE_OLTRE}
                        />
                      ) : null}
                    </>
                  )}
                  {/* Oggi: una tacca sotto l'asse, non un colore in più. */}
                  {g.oggi ? (
                    <rect
                      x={x}
                      y={PAD.top + innerH + 3}
                      width={larghezzaBarra}
                      height={2}
                      rx={1}
                      className="fill-brand-500"
                    />
                  ) : null}
                </g>
              );
            })}

            {/* I lunedì, e basta: trentuno numeri sotto un grafico non li
                legge nessuno. */}
            {giorni.map((g, i) => {
              const giornoSettimana = new Date(`${g.giorno}T12:00:00`).getDay();
              if (giornoSettimana !== 1) return null;
              return (
                <text
                  key={`t-${g.giorno}`}
                  x={PAD.left + i * passo + passo / 2}
                  y={ALTEZZA - 6}
                  textAnchor="middle"
                  className="fill-ink-muted font-mono text-[10px]"
                >
                  {g.numero}
                </text>
              );
            })}
          </svg>
        ) : null}
        <ChartTip tip={tip} />
      </div>

      {/* Legenda: forma e colore insieme, mai il colore da solo. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-[30px]">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2 rounded-sm bg-ink-secondary"
          />
          Entro le 8 ore
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2 rounded-sm bg-warning"
          />
          Oltre l&rsquo;orario
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span
            aria-hidden
            className="inline-block w-4 border-t border-dashed border-input"
          />
          Giornata piena
        </span>
      </div>

      {/* La stessa cosa a parole, per chi il grafico non lo vede. Il metodo
          chiede che un valore chiave non viva solo nel passaggio del mouse. */}
      <table className="sr-only">
        <caption>Ore lavorate giorno per giorno</caption>
        <tbody>
          {giorni
            .filter((g) => g.minuti > 0)
            .map((g) => (
              <tr key={g.giorno}>
                <th scope="row">{g.giorno}</th>
                <td>{inOre(g.minuti)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
