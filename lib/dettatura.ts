"use client";

import * as React from "react";

/**
 * Dettare invece di scrivere.
 *
 * Usa il riconoscimento vocale del browser: niente chiavi, niente costi,
 * niente audio che esce dal computer verso un servizio nostro. È il
 * browser a occuparsene — su Chrome ed Edge esiste, su Firefox no, e in
 * quel caso il pulsante semplicemente non compare. Meglio assente che
 * presente e inerte.
 *
 * `interimResults` è acceso di proposito: vedere le parole comparire
 * mentre si parla è l'unico modo di sapere che il microfono sta davvero
 * ascoltando. Un pulsante che lampeggia senza mostrare niente lascia
 * parlare a vuoto per venti secondi.
 */

/* I tipi del riconoscimento vocale non stanno nel DOM standard: si
   dichiara il minimo che serve, invece di spegnere il controllo dei tipi
   su tutto il file. */
interface RisultatoVocale {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoVocale {
  resultIndex: number;
  results: { length: number; [i: number]: RisultatoVocale };
}
interface Riconoscitore {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: EventoVocale) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function costruttore(): (new () => Riconoscitore) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Riconoscitore;
    webkitSpeechRecognition?: new () => Riconoscitore;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDettatura(onTesto: (testo: string) => void) {
  const [ascolta, setAscolta] = React.useState(false);
  const [errore, setErrore] = React.useState<string | null>(null);
  const rifRiconoscitore = React.useRef<Riconoscitore | null>(null);
  /* Il testo già presente quando si è premuto il microfono: la dettatura
     si aggiunge a quello che c'era, non lo sostituisce. */
  const rifBase = React.useRef("");
  /* La callback si aggiorna in un effetto e non durante il render: scrivere
     su un ref mentre si disegna è proprio ciò che il React Compiler vieta,
     perché in un render annullato lascerebbe il ref avanti rispetto a quello
     che si vede. */
  const rifCallback = React.useRef(onTesto);
  React.useEffect(() => {
    rifCallback.current = onTesto;
  }, [onTesto]);

  const [disponibile] = React.useState(() => costruttore() !== null);

  const ferma = React.useCallback(() => {
    rifRiconoscitore.current?.stop();
    rifRiconoscitore.current = null;
    setAscolta(false);
  }, []);

  const avvia = React.useCallback((testoAttuale: string) => {
    const Costruttore = costruttore();
    if (!Costruttore) return;
    setErrore(null);
    rifBase.current = testoAttuale.trim();

    const r = new Costruttore();
    r.lang = "it-IT";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let parlato = "";
      for (let i = 0; i < e.results.length; i++) {
        parlato += e.results[i][0].transcript;
      }
      const base = rifBase.current;
      rifCallback.current(base ? `${base} ${parlato.trim()}` : parlato.trim());
    };
    r.onerror = (e) => {
      /* «no-speech» capita di continuo se si fa una pausa: non è un guasto
         e dirlo sarebbe rumore. Il permesso negato invece va spiegato,
         perché altrimenti il microfono sembra rotto. */
      if (e.error === "no-speech" || e.error === "aborted") return;
      setErrore(
        e.error === "not-allowed"
          ? "Il browser non ha il permesso di usare il microfono."
          : "Dettatura non riuscita: prova a scrivere.",
      );
      setAscolta(false);
    };
    r.onend = () => setAscolta(false);

    rifRiconoscitore.current = r;
    r.start();
    setAscolta(true);
  }, []);

  /* Uscendo dalla pagina il microfono si spegne: lasciarlo acceso è il
     genere di cosa che si scopre dalla spia della webcam. */
  React.useEffect(() => () => rifRiconoscitore.current?.stop(), []);

  return { disponibile, ascolta, errore, avvia, ferma };
}
