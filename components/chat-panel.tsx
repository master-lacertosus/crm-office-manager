"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare, Send, X } from "lucide-react";

import { extractMentionIds, splitMentions } from "@/lib/mentions";
import { sheet } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  GENERAL,
  fetchReads,
  fetchRecentMessages,
  insertMessage,
  markChannelRead,
  subscribeToChat,
  type ChannelKey,
  type ChatMessage,
} from "@/lib/supabase/chat";
import { insertNotifications } from "@/lib/supabase/queries";
import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Orario del messaggio; la data solo se non è oggi. */
function quando(iso: string): string {
  const d = new Date(iso);
  const oggi = new Date();
  const stessoGiorno = d.toDateString() === oggi.toDateString();
  return stessoGiorno
    ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Chat interna: canale «Generale» più uno per progetto.
 *
 * I messaggi di TUTTI i canali si tengono in memoria insieme, non solo quelli
 * della stanza aperta: serve a mostrare i pallini dei non letti sugli altri
 * canali, che sono metà del motivo per cui una chat serve.
 */
export function ChatPanel() {
  const { profiles, projects, currentUser, loading } = useAppStore();

  const [open, setOpen] = React.useState(false);
  const [canale, setCanale] = React.useState<ChannelKey>(GENERAL);
  const [messaggi, setMessaggi] = React.useState<ChatMessage[]>([]);
  const [letture, setLetture] = React.useState<Record<string, string>>({});
  const [collegati, setCollegati] = React.useState<string[]>([]);
  const [bozza, setBozza] = React.useState("");
  const [inviando, setInviando] = React.useState(false);
  const [errore, setErrore] = React.useState<string | null>(null);
  const fondoRef = React.useRef<HTMLDivElement>(null);

  const pronto = isSupabaseConfigured && !loading && Boolean(currentUser.id);

  const canali = React.useMemo(
    () => [
      { key: GENERAL, nome: "Generale" },
      ...projects
        .filter((p) => !p.is_archived)
        .map((p) => ({ key: p.id, nome: p.name })),
    ],
    [projects],
  );

  /* Primo caricamento: i messaggi di ogni canale e i segnalibri di lettura.
     Si caricano tutti i canali perché i non letti vanno contati anche per le
     stanze chiuse. */
  React.useEffect(() => {
    if (!pronto) return;
    let annullato = false;
    (async () => {
      try {
        const supabase = createClient();
        /* Una richiesta sola per tutti i canali. La versione precedente ne
           faceva una per progetto: con venti progetti erano ventuno viaggi
           di rete a ogni apertura dell'app. */
        const [recenti, salvate] = await Promise.all([
          fetchRecentMessages(supabase),
          fetchReads(supabase),
        ]);
        if (annullato) return;
        setMessaggi(recenti);
        setLetture(salvate);
      } catch (e) {
        if (!annullato) {
          setErrore(
            e instanceof Error ? e.message : "Chat non raggiungibile.",
          );
        }
      }
    })();
    return () => {
      annullato = true;
    };
    // projects non serve piu fra le dipendenze: i messaggi arrivano tutti
    // insieme, non piu un canale per volta.
  }, [pronto]);

  /* Sottoscrizione dal vivo. Una sola per tutta la chat: il filtro sul
     canale si applica quando si disegna, non quando si ascolta. */
  React.useEffect(() => {
    if (!pronto) return;
    const supabase = createClient();
    const sub = subscribeToChat(
      supabase,
      { id: currentUser.id, nome: currentUser.full_name },
      {
        onInsert: (m) =>
          setMessaggi((prev) =>
            // Il proprio messaggio è già in lista per via dell'inserimento
            // ottimistico: Realtime lo rimanda a tutti, mittente compreso.
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          ),
        onUpdate: (m) =>
          setMessaggi((prev) => prev.map((x) => (x.id === m.id ? m : x))),
        onDelete: (id) =>
          setMessaggi((prev) => prev.filter((x) => x.id !== id)),
        onPresence: setCollegati,
      },
    );
    return () => {
      void supabase.removeChannel(sub);
    };
  }, [pronto, currentUser.id, currentUser.full_name]);

  const delCanale = React.useMemo(
    () =>
      messaggi
        .filter((m) => (canale === GENERAL ? m.project_id === null : m.project_id === canale))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messaggi, canale],
  );

  const nonLetti = React.useCallback(
    (k: ChannelKey) => {
      const dopo = letture[k];
      return messaggi.filter(
        (m) =>
          (k === GENERAL ? m.project_id === null : m.project_id === k) &&
          m.author_id !== currentUser.id &&
          (!dopo || m.created_at > dopo),
      ).length;
    },
    [messaggi, letture, currentUser.id],
  );

  /* Scorrimento in fondo quando arriva qualcosa nella stanza aperta. */
  React.useEffect(() => {
    if (open) fondoRef.current?.scrollIntoView({ block: "end" });
  }, [delCanale.length, open, canale]);

  const segnaLetto = async (k: ChannelKey) => {
    if (!pronto) return;
    try {
      const quando = await markChannelRead(createClient(), currentUser.id, k);
      setLetture((prev) => ({ ...prev, [k]: quando }));
    } catch {
      /* il segnalibro è un di più: non vale un errore in faccia */
    }
  };

  const apri = () => {
    setOpen(true);
    void segnaLetto(canale);
  };

  const cambiaCanale = (k: ChannelKey) => {
    setCanale(k);
    void segnaLetto(k);
  };

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    const testo = bozza.trim();
    if (!testo || inviando) return;

    const messaggio: ChatMessage = {
      id: crypto.randomUUID(),
      project_id: canale === GENERAL ? null : canale,
      author_id: currentUser.id,
      body: testo,
      created_at: new Date().toISOString(),
      edited_at: null,
    };

    setInviando(true);
    setErrore(null);
    setBozza("");
    setMessaggi((prev) => [...prev, messaggio]);

    try {
      const supabase = createClient();
      await insertMessage(supabase, messaggio);

      // Le menzioni diventano avvisi veri, con lo stesso meccanismo dei
      // commenti: la campanella non distingue da dove arrivano.
      const menzionati = extractMentionIds(testo, profiles, currentUser.id);
      if (menzionati.length > 0) {
        const dove =
          canale === GENERAL
            ? "in Generale"
            : `nel canale ${projects.find((p) => p.id === canale)?.name ?? "progetto"}`;
        await insertNotifications(
          supabase,
          menzionati.map((id) => ({
            to_user_id: id,
            from_user_id: currentUser.id,
            message: `${currentUser.full_name.split(" ")[0]} ti ha citato ${dove}: «${testo.slice(0, 120)}»`,
            kind: "mention" as const,
          })),
        );
      }
      void segnaLetto(canale);
    } catch (err) {
      setMessaggi((prev) => prev.filter((m) => m.id !== messaggio.id));
      setBozza(testo);
      setErrore(err instanceof Error ? err.message : "Invio non riuscito.");
    } finally {
      setInviando(false);
    }
  };

  const totaleNonLetti = canali.reduce((n, c) => n + nonLetti(c.key), 0);

  if (!pronto) return null;

  const pannello = (
    /* Ancorato al bordo inferiore e centrato: sale dal bordo da cui è nato,
       invece di comparire in un angolo. Lascia liberi entrambi gli angoli —
       ed è il motivo per cui il coordinamento con il Cavaliere di Parma non
       serve più. */
    <motion.div
      variants={sheet}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed bottom-0 left-1/2 z-90 flex max-h-[min(620px,calc(100dvh-3rem))] w-[min(460px,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-white shadow-[0_-8px_48px_rgb(15_23_42/0.18)]"
    >
      <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2.5">
        <MessageSquare className="size-4 text-ink-muted" strokeWidth={1.75} />
        <span className="flex-1 text-[13px] font-semibold text-ink">
          Comunicazione rapida
        </span>
        {/* Presenza: chi è collegato ORA, dato che Realtime fornisce senza
            costo aggiuntivo. Meno uno perché conta anche noi. */}
        {collegati.length > 1 ? (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="size-1.5 rounded-full bg-success" />
            {collegati.length - 1} collegat
            {collegati.length - 1 === 1 ? "o" : "i"}
          </span>
        ) : null}
        <button
          onClick={() => setOpen(false)}
          aria-label="Chiudi la chat"
          className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-accent hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Canali */}
      <div className="flex gap-1 overflow-x-auto border-b border-border-soft px-2 py-1.5">
        {canali.map((c) => {
          const n = nonLetti(c.key);
          const attivo = c.key === canale;
          return (
            <button
              key={c.key}
              onClick={() => cambiaCanale(c.key)}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] transition-colors " +
                (attivo
                  ? "bg-accent font-semibold text-ink"
                  : "text-ink-secondary hover:bg-accent/60")
              }
            >
              {c.nome}
              {n > 0 && !attivo ? (
                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 font-mono text-[10px] font-semibold text-white">
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Messaggi */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {delCanale.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">
            Nessun messaggio qui. Scrivi il primo.
          </p>
        ) : (
          delCanale.map((m) => {
            const autore = profiles.find((p) => p.id === m.author_id);
            const mio = m.author_id === currentUser.id;
            return (
              <div key={m.id} className="flex gap-2.5">
                <AvatarInitials
                  name={autore?.full_name ?? "?"}
                  src={autore?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-ink">
                      {mio ? "Tu" : (autore?.full_name ?? "Sconosciuto")}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {quando(m.created_at)}
                      {m.edited_at ? " · modificato" : ""}
                    </span>
                  </div>
                  <p className="text-[13px] break-words whitespace-pre-wrap text-ink">
                    {splitMentions(m.body, profiles).map((parte, i) =>
                      parte.mention ? (
                        <span
                          key={i}
                          className="rounded bg-brand-100 px-1 font-medium text-brand-700"
                        >
                          {parte.text}
                        </span>
                      ) : (
                        <React.Fragment key={i}>{parte.text}</React.Fragment>
                      ),
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={fondoRef} />
      </div>

      {errore ? (
        <p role="alert" className="bg-danger-soft px-3 py-2 text-[12px] text-danger-text">
          {errore}
        </p>
      ) : null}

      <form onSubmit={invia} className="flex items-end gap-2 border-t border-border-soft p-2.5">
        <Textarea
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          onKeyDown={(e) => {
            // Invio manda, Maiusc+Invio va a capo: convenzione di ogni chat.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void invia(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Scrivi… usa @ per citare qualcuno"
          className="max-h-28 min-h-9 resize-none py-2 text-[13px]"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!bozza.trim() || inviando}
          aria-label="Invia"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </motion.div>
  );

  /* Semicerchio a filo del bordo inferiore: 80×40 con `rounded-t-full` è
     esattamente mezzo disco. Al passaggio del mouse sale di due pixel invece
     di ingrandirsi — il sistema di movimento vieta di animare le dimensioni,
     e uno spostamento verticale suggerisce comunque «tirami su». */
  const linguetta = (
    <motion.button
      variants={sheet}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={apri}
      aria-label={
        totaleNonLetti > 0
          ? `Apri la comunicazione rapida, ${totaleNonLetti} non letti`
          : "Apri la comunicazione rapida"
      }
      className="btn-glow fixed bottom-0 left-1/2 z-90 flex h-10 w-20 -translate-x-1/2 items-end justify-center rounded-t-full pb-2.5 text-white shadow-[0_-6px_24px_rgb(15_23_42/0.22)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <MessageSquare className="size-5" strokeWidth={1.75} />
      {totaleNonLetti > 0 ? (
        <span className="absolute top-1 right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-4 font-semibold text-white ring-2 ring-white">
          {totaleNonLetti}
        </span>
      ) : null}
    </motion.button>
  );

  return typeof document !== "undefined"
    ? createPortal(
        /* `mode="wait"` evita che linguetta e pannello si incrocino a metà
           strada: uno esce del tutto, poi entra l'altro. Occupano lo stesso
           punto del bordo, e sovrapporli darebbe un guizzo. */
        <AnimatePresence mode="wait">
          {open ? (
            <React.Fragment key="pannello">{pannello}</React.Fragment>
          ) : (
            <React.Fragment key="linguetta">{linguetta}</React.Fragment>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;
}
