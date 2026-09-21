"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RigaOpzione } from "@/components/sondaggi/riga-opzione";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { useTrappolaFuoco } from "@/lib/fuoco";
import { dur, ease, pop, scrim } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import {
  chiManca,
  daInterrompere,
  eAperto,
  inTesta,
  tempoRimasto,
} from "@/lib/sondaggi";
import { useAppStore } from "@/lib/store";

/*
 * Questo prodotto scoraggia i modali, e la regola vale: per un DETTAGLIO si
 * apre un pannello laterale, non un dialogo che copre tutto.
 *
 * Un sondaggio lanciato non è un dettaglio, e non è nemmeno un avviso: è un
 * evento a tempo — una domanda sola, con una risposta sola, che scade. Per
 * questo interrompe. E siccome interrompe, lo fa alle condizioni più strette
 * che si possano scrivere: una volta sola per sondaggio, mai a chi ha già
 * votato, mai sopra un altro dialogo, mai durante il caricamento, e sempre
 * con un'uscita a un tasto che non è un voto.
 */
export function PopupSondaggio() {
  const {
    sondaggi,
    sondaggiScartati,
    scartaSondaggio,
    votaSondaggio,
    profiles,
    currentUser,
    loading,
    syncError,
    clearSyncError,
  } = useAppStore();

  const { prefs } = usePreferences();
  const ridotto = useReducedMotion() || prefs.reduceMotion;

  const scheda = React.useRef<HTMLFormElement>(null);
  const bottoneChiudi = React.useRef<HTMLButtonElement>(null);
  const idDomanda = React.useId();
  const idNota = React.useId();

  const [scelta, setScelta] = React.useState<string | null>(null);
  const [invio, setInvio] = React.useState(false);
  const [votato, setVotato] = React.useState(false);

  /* Un orologio al minuto. La scadenza va mostrata e va rispettata: fra il
     momento in cui scade e il passaggio successivo del lavoro pianificato
     passano fino a cinque minuti, e in quei minuti la riga dice ancora
     «aperto». Al minuto e non al secondo — un contatore che scorre sarebbe
     un secondo movimento che nessuno ha chiesto. */
  const [adesso, setAdesso] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const candidato = daInterrompere(
    sondaggi,
    currentUser.id,
    sondaggiScartati,
    adesso,
  );

  /*
   * Non ci si apre sopra un altro dialogo.
   *
   * A z-95 questo popup finirebbe DIETRO l'invito, il nuovo progetto, il
   * profilo iniziale e il banner degli errori — che stanno tutti a z-100 —
   * con `aria-modal` e una trappola del fuoco, dentro una scheda che non si
   * vede. E si metterebbe SOPRA la chat (qualcuno a metà frase), il tour, la
   * modalità standup proiettata e il pannello del task.
   *
   * Quindi aspetta, e riprova: è lo stesso meccanismo con cui si fa da parte
   * «Il Capo».
   */
  const [altroDialogo, setAltroDialogo] = React.useState(true);
  React.useEffect(() => {
    if (!candidato || loading || !currentUser.id) return;
    let vivo = true;
    const prova = () => {
      if (!vivo) return;
      const occupato = document.querySelector('[role="dialog"]') !== null;
      setAltroDialogo(occupato);
      /* Finché la strada è occupata si riprova; quando è libera il giro
         finisce qui — il dialogo che comparirà un istante dopo è il nostro,
         e ritrovarlo ci farebbe richiudere da soli. */
      if (occupato) setTimeout(prova, 1_500);
    };
    /* Il primo controllo esce dal corpo dell'effetto: interrogare il DOM è
       leggere uno stato esterno, e scriverlo dentro l'effetto farebbe
       ridisegnare a cascata. */
    const avvio = setTimeout(prova, 0);
    return () => {
      vivo = false;
      clearTimeout(avvio);
    };
  }, [candidato, loading, currentUser.id]);

  const sondaggio = candidato;
  const aperto =
    Boolean(sondaggio) && !loading && Boolean(currentUser.id) && !altroDialogo;

  /* Si può chiudere sotto gli occhi: lo chiude il trigger quando firma
     l'ultima persona, o il lavoro pianificato quando scade. Senza questo
     ramo un voto in ritardo verrebbe respinto dalla policy e comparirebbe
     come «Risposta non registrata» — un guasto di rete travestito da esito
     normale. */
  const ancoraAperto = sondaggio ? eAperto(sondaggio, adesso) : false;
  const soloLettura = !ancoraAperto;

  /* L'avviso si ricava, non si conserva: sono tre frasi decise da due
     condizioni che già esistono, e tenerne una copia in uno stato vorrebbe
     dire scriverla da dentro un effetto — cioè far ridisegnare a cascata per
     un dato che non è mai stato indipendente. */
  const avviso = votato
    ? "Risposta registrata. Resta anonima."
    : soloLettura
      ? "Il sondaggio è stato chiuso: ecco com'è andata."
      : "";

  const piuTardi = React.useCallback(() => {
    if (sondaggio) scartaSondaggio(sondaggio.id);
  }, [sondaggio, scartaSondaggio]);

  /* Esc mette via, non vota. In fase di CATTURA con
     `stopImmediatePropagation`, perché nel prodotto una ventina di dialoghi
     ascoltano tutti su `window` in bolla: un solo Esc ne chiuderebbe due, e
     la regola dice che chiude l'overlay più recente. */
  React.useEffect(() => {
    if (!aperto) return;
    const suTasto = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      piuTardi();
    };
    window.addEventListener("keydown", suTasto, true);
    return () => window.removeEventListener("keydown", suTasto, true);
  }, [aperto, piuTardi]);

  useTrappolaFuoco(scheda, aperto);

  /* Quando `votato` scatta, il pulsante su cui si è appena premuto Invio
     viene smontato e il fuoco cade su `<body>` — da lì nemmeno la trappola
     lo recupera. Va spostato a mano. */
  React.useEffect(() => {
    if (votato || soloLettura) bottoneChiudi.current?.focus();
  }, [votato, soloLettura]);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scelta || !sondaggio) return;
    setInvio(true);
    const fatto = await votaSondaggio(sondaggio.id, scelta);
    setInvio(false);
    /* Prima di qualunque annuncio. È il difetto che su questo repo ha già
       fatto sparire una richiesta vera: l'avviso era partito, la riga non
       era mai esistita. */
    if (!fatto) return;
    setVotato(true);
  };

  const mostraRisultati = votato || soloLettura;
  const autore = sondaggio
    ? profiles.find((p) => p.id === sondaggio.autore_id)
    : undefined;
  const testa = sondaggio && mostraRisultati ? inTesta(sondaggio) : [];
  const mancanti =
    sondaggio && mostraRisultati ? chiManca(sondaggio, profiles) : [];

  const dialogo = (
    <AnimatePresence>
      {aperto && sondaggio ? (
        /* `overflow-hidden`: l'alone è più largo di un telefono e non deve
           generare scorrimento orizzontale. */
        <div className="fixed inset-0 z-[95] overflow-hidden print:hidden">
          {/* 1. IL VELO. Dal token `--scrim`. `bg-ink/20` in tema scuro
                 sarebbe BIANCO, perché `--ink` di notte è quasi bianco: è un
                 difetto vivo in altri due dialoghi del prodotto. */}
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={piuTardi}
            aria-hidden
            className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
          />

          {/* 2. L'ALONE. Una luce dietro la scheda, non una vernice sopra il
                 velo: `plus-lighter` sta dentro `.alone-marca`, insieme alle
                 sue due uscite (trasparenza ridotta, contrasto alto). Scritto
                 inline le scavalcherebbe tutte e due. */}
          <motion.div
            aria-hidden
            initial={ridotto ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            /* L'uscita non eredita il ritardo dell'entrata. Senza questo, in
               chiusura la scheda sparisce in 0,10s, il velo in 0,18s, e
               l'alone resterebbe da solo — arancione, sopra l'applicazione
               viva — per un decimo di secondo buono. */
            exit={{ opacity: 0, transition: { duration: 0.1, ease: ease.inOut } }}
            transition={{ duration: dur.base, ease: ease.out, delay: 0.06 }}
            className="alone-marca pointer-events-none absolute top-1/2 left-1/2 size-[760px] max-w-none -translate-x-1/2 -translate-y-1/2"
          />

          {/* 3. LA SCHEDA. Telaio fermo, corpo che scorre: il filo di luce in
                 cima è posizionato in assoluto, e dentro un contenitore che
                 scorre vivrebbe nello spazio del contenuto — con sei opzioni
                 su un telefono uscirebbe dall'inquadratura al primo scorri,
                 mentre lo sfondo resterebbe fermo. Due materiali su quattro
                 si disallineerebbero appena si tocca la rotella. */}
          <motion.form
            ref={scheda}
            onSubmit={invia}
            variants={pop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby={idDomanda}
            aria-describedby={idNota}
            style={
              {
                "--aurora":
                  "color-mix(in oklch, var(--brand-500), transparent 88%)",
              } as React.CSSProperties
            }
            className="card-soft tile-aurora hairline-gradient absolute inset-x-4 top-1/2 mx-auto flex max-h-[85dvh] max-w-md -translate-y-1/2 flex-col shadow-[var(--ombra-dialogo)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
                Sondaggio del team
              </p>
              <h2
                id={idDomanda}
                className="mt-1 text-[18px]/6 font-bold tracking-[-0.01em] text-ink sm:text-[20px]/7"
              >
                {sondaggio.domanda}
              </h2>
              <p id={idNota} className="mt-1 text-sm text-ink-secondary">
                Voto anonimo: si vede chi ha votato, non cosa.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                {autore ? (
                  <>
                    <AvatarInitials
                      name={autore.full_name}
                      src={autore.avatar_url}
                      size="sm"
                    />
                    <span>
                      Lanciato da {autore.full_name.split(" ")[0]} ·{" "}
                      {timeAgo(sondaggio.aperto_at)}
                    </span>
                  </>
                ) : null}
                {/* La scadenza si mostra sempre: senza, si preme «Più tardi»
                    senza sapere quanto tardi si può. */}
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">
                  {ancoraAperto
                    ? `si chiude fra ${tempoRimasto(sondaggio, adesso)}`
                    : "chiuso"}
                </span>
              </div>

              <fieldset className="mt-4" disabled={invio || mostraRisultati}>
                <legend className="sr-only">{sondaggio.domanda}</legend>
                <ul className="space-y-2">
                  {sondaggio.opzioni.map((o, i) => (
                    <RigaOpzione
                      key={o.id}
                      opzione={o}
                      totale={sondaggio.voti_totali}
                      indice={i}
                      votato={mostraRisultati}
                      inTesta={testa.some((t) => t.id === o.id)}
                      scelta={
                        mostraRisultati
                          ? sondaggio.miaScelta === o.id
                          : scelta === o.id
                      }
                      onScegli={mostraRisultati ? undefined : setScelta}
                      nomeGruppo={`sondaggio-${sondaggio.id}`}
                    />
                  ))}
                </ul>
              </fieldset>

              {/* Montata sempre, e vuota all'inizio: una regione inserita nel
                  DOM insieme al proprio testo tipicamente non viene
                  annunciata. */}
              <p role="status" aria-live="polite" className="sr-only">
                {avviso}
              </p>

              {mostraRisultati ? (
                <div className="mt-4 border-t border-border-soft pt-3">
                  <p className="font-mono text-[13px] tabular-nums text-ink-secondary">
                    Hanno risposto {sondaggio.voti_totali} su{" "}
                    {sondaggio.aventi_diritto}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {sondaggio.firme.map((id) => {
                      const p = profiles.find((x) => x.id === id);
                      return p ? (
                        <AvatarInitials
                          key={id}
                          name={p.full_name}
                          src={p.avatar_url}
                          size="sm"
                        />
                      ) : null;
                    })}
                    {mancanti.map((p) => (
                      <span
                        key={p.id}
                        aria-hidden
                        title={`${p.full_name} non ha ancora votato`}
                        className="size-5 rounded-full border border-dashed border-ink-muted bg-card"
                      />
                    ))}
                  </div>
                  {/* Gli avatar da soli non sono un'informazione leggibile:
                      i nomi si scrivono. */}
                  {mancanti.length > 0 ? (
                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      Manca{mancanti.length === 1 ? "" : "no"}{" "}
                      {mancanti.map((p) => p.full_name.split(" ")[0]).join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* L'errore si ripete qui dentro. Il banner di sistema sta
                  fuori dal portale e fuori dalla trappola del fuoco: chi
                  naviga da tastiera non arriverebbe mai alla sua X. */}
              {syncError ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-danger-text/30 bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
                >
                  <span className="min-w-0 flex-1">{syncError}</span>
                  <Button variant="ghost" size="sm" onClick={clearSyncError}>
                    Ho capito
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-soft px-5 pt-4 pb-5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              {mostraRisultati ? (
                <>
                  <p className="text-[13px] text-ink-muted sm:mr-auto">
                    {soloLettura && !votato
                      ? "Il sondaggio si è chiuso."
                      : "Risposta registrata. Resta anonima."}
                  </p>
                  <Button
                    ref={bottoneChiudi}
                    type="button"
                    variant="outline"
                    onClick={piuTardi}
                  >
                    Chiudi
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={piuTardi}>
                    Più tardi
                  </Button>
                  <Button type="submit" disabled={!scelta} aria-busy={invio}>
                    {invio ? "Invio…" : "Invia la risposta"}
                  </Button>
                </>
              )}
            </div>
          </motion.form>
        </div>
      ) : null}
    </AnimatePresence>
  );

  /* Il portale non è opzionale: la barra superiore ha `backdrop-filter`, e
     questo la rende contenitore di riferimento per ogni `fixed` che le sta
     sotto. In questo prodotto è già costato due volte. */
  return typeof document !== "undefined"
    ? createPortal(dialogo, document.body)
    : null;
}
