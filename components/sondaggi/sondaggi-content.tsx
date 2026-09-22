"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Plus, Vote, X } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { EmptyState } from "@/components/empty-state";
import { RigaOpzione } from "@/components/sondaggi/riga-opzione";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDue, timeAgo } from "@/lib/format";
import { rise } from "@/lib/motion";
import { eResponsabile } from "@/lib/permessi";
import {
  chiHaScelto,
  chiManca,
  eAperto,
  hoVotato,
  inTesta,
  perche,
  scadenzaMassima,
  scadenzaMinima,
  scadenzaPredefinita,
  sondaggioAperto,
  tempoRimasto,
  type Sondaggio,
} from "@/lib/sondaggi";
import { useAppStore } from "@/lib/store";

const MAX_OPZIONI = 8;

/**
 * I sondaggi al team: quello in corso, quello che stai per lanciare, e
 * quelli finiti.
 *
 * Una colonna sola e tre blocchi. Niente riga di indicatori in cima: quattro
 * numeri su un sondaggio sarebbero riempitivo, e questa pagina ha una
 * domanda sola da far vedere.
 */
export function SondaggiContent() {
  const {
    sondaggi,
    profiles,
    lanciaSondaggio,
    votaSondaggio,
    chiudiSondaggio,
    scartaSondaggio,
  } = useAppStore();
  const toast = useToast();

  const [adesso, setAdesso] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const inCorso = sondaggioAperto(sondaggi, adesso);
  const chiusi = sondaggi.filter((s) => !eAperto(s, adesso));

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      {inCorso ? (
        <CardInCorso
          sondaggio={inCorso}
          adesso={adesso}
          onVota={votaSondaggio}
          onChiudi={chiudiSondaggio}
        />
      ) : null}

      <ModuloLancio
        bloccatoDa={inCorso}
        adesso={adesso}
        onLancia={lanciaSondaggio}
        onFatto={(id) => {
          /* Chi lo ha appena lanciato lo sta già guardando: il popup gli
             coprirebbe la scheda qui sopra per mostrargli la stessa cosa.
             Votare lo può comunque, da lì. */
          scartaSondaggio(id);
          toast("Sondaggio lanciato: lo vedono tutti");
        }}
      />

      <section>
        <h2 className="mb-2 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          Storico
        </h2>
        {chiusi.length === 0 ? (
          <EmptyState
            icon={Vote}
            title={
              inCorso
                ? "Nessun sondaggio chiuso, per ora"
                : "Nessun sondaggio, per ora"
            }
            hint={
              inCorso
                ? "Qui finiranno i sondaggi finiti, con i loro risultati. Quello in corso sta qui sopra."
                : "Il primo lo lanci da qui: una domanda, due risposte, e lo vedono tutti."
            }
          />
        ) : (
          <ul className="space-y-2">
            {chiusi.map((s) => (
              <RigaArchivio key={s.id} sondaggio={s} profili={profiles} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  /* Le tre sezioni stanno qui sotto come componenti a sé: definite dentro
     questo, React le tratterebbe come tipi nuovi a ogni disegno e le
     smonterebbe invece di aggiornarle — con un modulo aperto vorrebbe dire
     perdere quello che si sta scrivendo. */
}

/** Il sondaggio aperto: si vota, o si guarda com'è andata. */
function CardInCorso({
  sondaggio,
  adesso,
  onVota,
  onChiudi,
}: {
  sondaggio: Sondaggio;
  adesso: Date;
  onVota: (sondaggioId: string, opzioneId: string) => Promise<boolean>;
  onChiudi: (id: string) => Promise<boolean>;
}) {
  const { profiles, currentUser } = useAppStore();
  const [scelta, setScelta] = React.useState<string | null>(null);
  const [invio, setInvio] = React.useState(false);
  const [chiudendo, setChiudendo] = React.useState(false);

  const votato = hoVotato(sondaggio, currentUser.id);
  const autore = profiles.find((p) => p.id === sondaggio.autore_id);
  const testa = votato ? inTesta(sondaggio) : [];
  const mancanti = votato ? chiManca(sondaggio, profiles) : [];
  const scaduto = new Date(sondaggio.scade_at).getTime() <= adesso.getTime();

  /* Esattamente le tre strade che concede `chiudi_sondaggio()` sul database:
     chi l'ha lanciato, un responsabile, o chiunque se è già scaduto.
     L'interfaccia offre quello che il database concede, né più né meno —
     offrire di meno nasconde una via d'uscita, offrire di più promette un
     gesto che verrà rifiutato. */
  const puoChiudere =
    sondaggio.autore_id === currentUser.id ||
    eResponsabile(currentUser) ||
    scaduto;

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scelta) return;
    setInvio(true);
    await onVota(sondaggio.id, scelta);
    setInvio(false);
    /* Nessun toast: la riga che si trasforma in barra è già la risposta. */
  };

  return (
    <section
      style={
        {
          "--aurora": "color-mix(in oklch, var(--brand-500), transparent 88%)",
        } as React.CSSProperties
      }
      className="card-soft tile-aurora hairline-gradient p-5"
    >
      <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-secondary uppercase">
        In corso
      </p>
      <h2 className="mt-1 text-[20px]/7 font-bold tracking-[-0.01em] text-ink">
        {sondaggio.domanda}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
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
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">
          si chiude fra {tempoRimasto(sondaggio, adesso)}
        </span>
      </div>

      <form onSubmit={invia} className="mt-4">
        <fieldset disabled={invio || votato}>
          <legend className="sr-only">{sondaggio.domanda}</legend>
          <ul className="space-y-2">
            {sondaggio.opzioni.map((o, i) => (
              <RigaOpzione
                key={o.id}
                opzione={o}
                totale={sondaggio.voti_totali}
                indice={i}
                votato={votato}
                inTesta={testa.some((t) => t.id === o.id)}
                scelta={votato ? sondaggio.miaScelta === o.id : scelta === o.id}
                onScegli={votato ? undefined : setScelta}
                nomeGruppo={`pagina-${sondaggio.id}`}
                firmatari={chiHaScelto(sondaggio, o.id)
                  .map((id) => profiles.find((p) => p.id === id))
                  .filter((p) => p !== undefined)}
              />
            ))}
          </ul>
        </fieldset>

        {votato ? (
          <div className="mt-3 border-t border-border-soft pt-3">
            <p className="font-mono text-[13px] tabular-nums text-ink-secondary">
              Hanno risposto {sondaggio.voti_totali} su{" "}
              {sondaggio.aventi_diritto}
            </p>
            {mancanti.length > 0 ? (
              <p className="mt-1 text-[13px] text-ink-muted">
                Mancano ancora{" "}
                {mancanti.map((p) => p.full_name.split(" ")[0]).join(", ")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={!scelta} aria-busy={invio}>
              {invio ? "Invio…" : "Invia la risposta"}
            </Button>
          </div>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
        <p className="text-[13px] text-ink-muted">
          {sondaggio.palese
            ? "Risposte firmate: accanto a ogni risposta si legge chi l’ha scelta."
            : "Voto anonimo: si vede chi ha votato, non cosa."}
        </p>
        {puoChiudere ? (
          <Button
            variant="outline"
            size="sm"
            aria-busy={chiudendo}
            onClick={async () => {
              setChiudendo(true);
              await onChiudi(sondaggio.id);
              setChiudendo(false);
            }}
          >
            {chiudendo ? "Chiusura…" : "Chiudi il sondaggio"}
          </Button>
        ) : (
          <p className="text-[13px] text-ink-muted">
            Lo chiude {autore?.full_name.split(" ")[0] ?? "chi l'ha lanciato"} o
            un responsabile. Altrimenti si chiude da solo fra{" "}
            <span className="font-mono tabular-nums">
              {tempoRimasto(sondaggio, adesso)}
            </span>
            .
          </p>
        )}
      </div>
    </section>
  );
}

/** Il modulo per lanciarne uno. Resta scrivibile anche mentre un altro è in
 *  corso: il blocco è una strada corta, non un muro. */
function ModuloLancio({
  bloccatoDa,
  adesso,
  onLancia,
  onFatto,
}: {
  bloccatoDa: Sondaggio | null;
  adesso: Date;
  onLancia: (
    domanda: string,
    opzioni: string[],
    scadeAt: string,
    palese: boolean,
  ) => Promise<string | null>;
  onFatto: (id: string) => void;
}) {
  const [domanda, setDomanda] = React.useState("");
  const [opzioni, setOpzioni] = React.useState(["", ""]);
  const [scadeAt, setScadeAt] = React.useState(() =>
    scadenzaPredefinita(new Date()),
  );
  /* Anonimo è il valore di serie, e resta tale. In un ufficio di sei persone
     dove il titolare vede i voti, la gente vota quello che si aspetta che il
     titolare voglia sentire — e un sondaggio che raccoglie risposte di
     cortesia non serve a niente. Chi ha bisogno dei nomi lo dichiara. */
  const [palese, setPalese] = React.useState(false);
  const [invio, setInvio] = React.useState(false);
  const idMotivo = React.useId();

  const motivo = perche(domanda, opzioni, scadeAt, adesso);
  const bloccato = Boolean(bloccatoDa);

  const cambia = (i: number, valore: string) =>
    setOpzioni((prev) => prev.map((o, k) => (k === i ? valore : o)));

  const lancia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo || bloccato) return;
    setInvio(true);
    const id = await onLancia(
      domanda.trim(),
      opzioni.map((o) => o.trim()).filter(Boolean),
      /* Il campo dà un'ora locale («2026-09-23T17:30»); il database vuole un
         momento assoluto. `new Date()` su quella stringa la legge come locale,
         che è esattamente ciò che ha scelto chi la sta guardando. */
      new Date(scadeAt).toISOString(),
      palese,
    );
    setInvio(false);
    /* Prima di annunciare. Se il database ha rifiutato — perché nel
       frattempo qualcun altro ne ha aperto uno — la frase è già nel banner,
       e quello che si è scritto resta dov'è. */
    if (!id) return;
    setDomanda("");
    setOpzioni(["", ""]);
    setScadeAt(scadenzaPredefinita(new Date()));
    setPalese(false);
    onFatto(id);
  };

  return (
    <section className="card-soft p-5">
      <h2 className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        Lancia un sondaggio
      </h2>

      <form onSubmit={lancia} className="mt-3">
        <fieldset disabled={invio} className="space-y-3">
          <legend className="sr-only">Nuovo sondaggio</legend>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="domanda">La domanda</Label>
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                {domanda.trim().length}/200
              </span>
            </div>
            <Input
              id="domanda"
              value={domanda}
              maxLength={200}
              placeholder="Che giorno facciamo la riunione?"
              onChange={(e) => setDomanda(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Dieci righe che trasformano un vincolo di grafica in una
              funzione: la domanda resa nella tipografia esatta del popup
              dice subito se è troppo lunga per stare in grande. */}
          {domanda.trim().length > 0 ? (
            <div className="rounded-xl border border-border-soft p-3">
              <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-faint uppercase">
                Così lo vedranno
              </p>
              <p className="mt-1 text-[18px]/6 font-bold tracking-[-0.01em] text-ink sm:text-[20px]/7">
                {domanda}
              </p>
            </div>
          ) : null}

          <div>
            <Label>Le risposte</Label>
            <ul className="mt-1 space-y-2">
              {opzioni.map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    value={o}
                    maxLength={80}
                    placeholder={i === 0 ? "Martedì" : "Giovedì"}
                    aria-label={`Risposta ${i + 1}`}
                    onChange={(e) => cambia(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={opzioni.length <= 2}
                    aria-label={`Togli la risposta ${i + 1}`}
                    onClick={() =>
                      setOpzioni((prev) => prev.filter((_, k) => k !== i))
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            {opzioni.length < MAX_OPZIONI ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1.5"
                onClick={() => setOpzioni((prev) => [...prev, ""])}
              >
                <Plus data-icon="inline-start" />
                Aggiungi risposta
              </Button>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">
                Otto risposte sono il massimo: oltre, nessuno legge più.
              </p>
            )}
          </div>

          <div className="max-w-64">
            <Label htmlFor="scadenza">Si chiude il</Label>
            {/* Un momento scelto, non un intervallo di ore: un sondaggio
                scade quando serve la risposta — prima della riunione, entro
                stasera — non dopo un numero tondo di ore. */}
            <Input
              id="scadenza"
              type="datetime-local"
              value={scadeAt}
              min={scadenzaMinima(adesso)}
              max={scadenzaMassima(adesso)}
              onChange={(e) => setScadeAt(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-[12px] text-ink-faint">
              Proposta: domani a fine giornata. Si chiude comunque da solo
              appena hanno risposto tutti.
            </p>
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-2 select-none">
              <input
                type="checkbox"
                checked={palese}
                onChange={(e) => setPalese(e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 accent-brand-500"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">
                  Risposte firmate
                </span>
                {/* La conseguenza scritta accanto alla spunta, non in un
                    fumetto: chi la accende sta togliendo una garanzia agli
                    altri, e deve leggerlo prima, non scoprirlo dopo. */}
                <span className="block text-[12px] text-ink-muted">
                  {palese
                    ? "Accanto a ogni risposta si leggerà il nome di chi l'ha scelta."
                    : "Ora è anonimo: si vede chi ha votato, non cosa. Accendilo per le domande in cui la risposta è «chi» — un turno da coprire, una disponibilità."}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
          <p className="text-[13px] text-ink-muted">
            Lo vedono tutti, subito. Le risposte restano anonime.
          </p>
          <Button
            type="submit"
            disabled={Boolean(motivo) || bloccato || invio}
            aria-busy={invio}
            aria-describedby={motivo || bloccato ? idMotivo : undefined}
          >
            {invio ? "Lancio…" : "Lancia il sondaggio"}
          </Button>
        </div>

        {/* Il perché sta scritto, non in un fumetto al passaggio del mouse:
            un fumetto non esiste da tastiera né su un telefono. */}
        <p id={idMotivo} role="status" aria-live="polite" className="mt-2 text-[13px] text-ink-muted">
          {bloccatoDa ? (
            <>
              Ne resta uno alla volta. Si lancia quando «{bloccatoDa.domanda}»
              si chiude — o da solo fra{" "}
              <span className="font-mono tabular-nums">
                {tempoRimasto(bloccatoDa, adesso)}
              </span>
              .
            </>
          ) : (
            motivo
          )}
        </p>
      </form>
    </section>
  );
}

/** Una riga dell'archivio, che si apre in posto invece di aprire un modale. */
function RigaArchivio({
  sondaggio,
  profili,
}: {
  sondaggio: Sondaggio;
  profili: { id: string; full_name: string; avatar_url?: string | null }[];
}) {
  const [aperta, setAperta] = React.useState(false);
  const testa = inTesta(sondaggio);

  return (
    <li className="card-soft overflow-hidden p-4">
      <button
        type="button"
        onClick={() => setAperta((v) => !v)}
        aria-expanded={aperta}
        className="flex w-full items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            {sondaggio.domanda}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <span className="font-mono tabular-nums">
              {sondaggio.chiuso_at
                ? formatDue(sondaggio.chiuso_at)
                : formatDue(sondaggio.scade_at)}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {sondaggio.voti_totali === 1
                ? "1 risposta"
                : `${sondaggio.voti_totali} risposte`}
            </span>
            {testa.map((o) => (
              <span
                key={o.id}
                className="glass-chip rounded-xl px-2 py-0.5 text-[12px] text-ink-secondary"
              >
                {o.testo}
              </span>
            ))}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 text-ink-faint transition-transform ${aperta ? "rotate-180" : ""}`}
        />
      </button>

      {/* Compare, non si allunga: animare l'altezza è vietato dal design
          system, e su una lista fa saltare tutto quello che sta sotto. */}
      <AnimatePresence initial={false}>
        {aperta ? (
          <motion.div
            variants={rise}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-3 border-t border-border-soft pt-3"
          >
            <ul className="space-y-2">
              {sondaggio.opzioni.map((o, i) => (
                <RigaOpzione
                  key={o.id}
                  opzione={o}
                  totale={sondaggio.voti_totali}
                  indice={i}
                  votato
                  inTesta={testa.some((t) => t.id === o.id)}
                  scelta={sondaggio.miaScelta === o.id}
                  firmatari={chiHaScelto(sondaggio, o.id)
                    .map((id) => profili.find((p) => p.id === id))
                    .filter((p) => p !== undefined)}
                />
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {sondaggio.firme.map((id) => {
                const p = profili.find((x) => x.id === id);
                return p ? (
                  <AvatarInitials
                    key={id}
                    name={p.full_name}
                    src={p.avatar_url}
                    size="sm"
                  />
                ) : null;
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
