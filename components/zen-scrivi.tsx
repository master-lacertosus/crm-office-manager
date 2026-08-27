"use client";

import * as React from "react";
import { LoaderCircle, Mic, MicOff, Sparkles, X } from "lucide-react";

import { useDettatura } from "@/lib/dettatura";
import { messaggioErrore } from "@/lib/errori";
import { interpreta, type TaskProposto } from "@/lib/interpreta";
import { puoAssegnareAdAltri } from "@/lib/permessi";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Si scrive quello che va fatto, e nascono i task.
 *
 * «Devo fare un video entro venerdì per Rimini Wellness e mi serve da
 * Lorenzo una landing entro il 12» sono due lavori, due responsabili, due
 * scadenze e un progetto: scriverlo è un gesto solo, compilarlo sono otto
 * campi.
 *
 * L'ANTEPRIMA NON È UNA CORTESIA, È IL PATTO. Sotto non c'è un modello
 * linguistico: ci sono regole, e le regole sbagliano. Far nascere i task
 * in silenzio da un'interpretazione approssimativa sarebbe peggio del
 * modulo — perché poi la board va anche ripulita. Qui si vede cosa sta per
 * succedere, si corregge quello che serve, e solo allora si conferma.
 *
 * Ogni deduzione dice da dove viene: «venerdì → scadenza». Chi corregge
 * capisce anche PERCHÉ ha sbagliato, e la volta dopo scrive meglio.
 */
export function ZenScrivi({
  onFatto,
  testoIniziale = "",
}: {
  onFatto?: () => void;
  /** Quello che era già stato scritto nella barra comandi: si riparte da
   *  lì invece di far ribattere la frase da capo. */
  testoIniziale?: string;
}) {
  const { profiles, projects, currentUser, createTask } = useAppStore();
  const toast = useToast();
  const [testo, setTesto] = React.useState(testoIniziale);
  const [bozze, setBozze] = React.useState<TaskProposto[] | null>(null);
  const [creando, setCreando] = React.useState(false);
  const dettatura = useDettatura(setTesto);

  const attivi = profiles.filter((p) => p.is_active);
  const progettiVivi = projects.filter((p) => !p.is_archived);
  const puoAffidare = puoAssegnareAdAltri(currentUser);

  const leggi = () => {
    const proposte = interpreta(testo, {
      profiles,
      projects,
      io: currentUser.id,
    });
    setBozze(proposte);
  };

  const aggiorna = (chiave: string, patch: Partial<TaskProposto>) =>
    setBozze(
      (prec) =>
        prec?.map((b) => (b.chiave === chiave ? { ...b, ...patch } : b)) ?? null,
    );

  const crea = async () => {
    if (!bozze || bozze.length === 0) return;
    setCreando(true);
    let fatti = 0;
    let errore: string | null = null;
    try {
      for (const b of bozze) {
        try {
          const padre = await createTask({
            title: b.titolo,
            owner_id: b.owner_id,
            due_date: b.due_date,
            project_id: b.project_id,
          });
          fatti++;
          /* I pezzi dopo il padre, che è quello a cui puntano. Ereditano
             il progetto: un pezzo altrove racconterebbe un'altra storia. */
          for (const p of b.pezzi ?? []) {
            await createTask({
              title: p.titolo,
              owner_id: p.owner_id,
              project_id: b.project_id,
              parent_id: padre.id,
            });
            fatti++;
          }
        } catch (e) {
          errore ??= messaggioErrore(e, "Non creato.");
        }
      }
    } finally {
      setCreando(false);
    }
    toast(
      [
        `${fatti} ${fatti === 1 ? "lavoro creato" : "lavori creati"}`,
        errore,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    setTesto("");
    setBozze(null);
    onFatto?.();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="zen-testo" className="flex items-center gap-1.5">
          <Sparkles aria-hidden className="size-3.5 text-brand-600" />
          Scrivi cosa va fatto
        </Label>
        <Textarea
          id="zen-testo"
          value={testo}
          onChange={(e) => {
            setTesto(e.target.value);
            /* Cambiando il testo l'anteprima vecchia non vale più: tenerla
               mostrerebbe task che non corrispondono a quello che c'è
               scritto. */
            if (bozze) setBozze(null);
          }}
          placeholder="Devo fare un video entro venerdì per Rimini Wellness e mi serve da Lorenzo una landing entro il 12"
          className="min-h-24"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              leggi();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={leggi}
            disabled={testo.trim().length < 4}
          >
            Vedi cosa nasce
          </Button>

          {/* Il microfono compare solo dove il browser sa ascoltare: su
              Firefox non esiste, e un pulsante presente ma inerte è
              peggio di uno assente. */}
          {dettatura.disponibile ? (
            <Button
              type="button"
              variant={dettatura.ascolta ? "default" : "outline"}
              size="icon"
              onClick={() =>
                dettatura.ascolta
                  ? dettatura.ferma()
                  : dettatura.avvia(testo)
              }
              aria-pressed={dettatura.ascolta}
              aria-label={dettatura.ascolta ? "Smetti di dettare" : "Detta"}
              title={
                dettatura.ascolta
                  ? "Sto ascoltando — premi per fermare"
                  : "Detta invece di scrivere"
              }
              className={cn(dettatura.ascolta && "animate-pulse")}
            >
              {dettatura.ascolta ? <MicOff /> : <Mic />}
            </Button>
          ) : null}
          <span className="text-[12px] text-ink-muted">
            {dettatura.ascolta
              ? "Sto ascoltando…"
              : "Nomi, progetti e date vengono riconosciuti. Controlli prima di confermare."}
          </span>
        </div>
        {dettatura.errore ? (
          <p className="text-[12px] text-danger-text">{dettatura.errore}</p>
        ) : null}
      </div>

      {bozze ? (
        bozze.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-[13px] text-ink-secondary">
            Da questo testo non ricavo niente. Prova a scrivere cosa va fatto,
            per chi e per quando.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
              {bozze.length === 1
                ? "Nascerà questo"
                : `Nasceranno questi ${bozze.length}`}
            </p>

            {bozze.map((b) => {
              /* Un dipendente non può affidare lavoro ad altri: lo si dice
                 qui, mentre si corregge, invece di lasciarlo scoprire da un
                 rifiuto del database. */
              const altrui = !puoAffidare && b.owner_id !== currentUser.id;
              return (
                <div
                  key={b.chiave}
                  className={cn(
                    "space-y-2 rounded-xl border p-3",
                    altrui ? "border-warning/60 bg-warning-soft/40" : "border-border",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={b.titolo}
                      onChange={(e) =>
                        aggiorna(b.chiave, { titolo: e.target.value })
                      }
                      aria-label="Titolo del lavoro"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setBozze(
                          (prec) =>
                            prec?.filter((x) => x.chiave !== b.chiave) ?? null,
                        )
                      }
                      aria-label={`Togli «${b.titolo}»`}
                    >
                      <X />
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <NativeSelect
                      value={b.owner_id}
                      onChange={(e) =>
                        aggiorna(b.chiave, { owner_id: e.target.value })
                      }
                      aria-label="Responsabile"
                    >
                      {attivi.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </NativeSelect>

                    <Input
                      type="date"
                      value={b.due_date ?? ""}
                      onChange={(e) =>
                        aggiorna(b.chiave, { due_date: e.target.value || null })
                      }
                      aria-label="Scadenza"
                    />

                    <NativeSelect
                      value={b.project_id ?? ""}
                      onChange={(e) =>
                        aggiorna(b.chiave, {
                          project_id: e.target.value || null,
                        })
                      }
                      aria-label="Progetto"
                    >
                      <option value="">Nessun progetto</option>
                      {progettiVivi.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {b.pezzi && b.pezzi.length > 0 ? (
                    <ul className="space-y-1 border-l-2 border-border pl-3">
                      {b.pezzi.map((p) => (
                        <li
                          key={p.chiave}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink">
                            {p.titolo}
                          </span>
                          <NativeSelect
                            className="w-32 shrink-0"
                            value={p.owner_id}
                            onChange={(e) =>
                              aggiorna(b.chiave, {
                                pezzi: b.pezzi?.map((x) =>
                                  x.chiave === p.chiave
                                    ? { ...x, owner_id: e.target.value }
                                    : x,
                                ),
                              })
                            }
                            aria-label={`Chi fa «${p.titolo}»`}
                          >
                            {attivi.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.full_name.split(" ")[0]}
                              </option>
                            ))}
                          </NativeSelect>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {b.perche.length > 0 ? (
                    /* Da dove viene ogni deduzione. Chi corregge capisce
                       anche PERCHÉ ha sbagliato, e la volta dopo scrive in
                       un modo che il sistema riconosce. */
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                      {b.perche.map((p) => (
                        <span key={p.campo}>
                          «{p.indizio}» → {p.campo}
                        </span>
                      ))}
                    </p>
                  ) : null}

                  {altrui ? (
                    <p className="text-[12px] font-medium text-warning-text">
                      Non puoi affidare lavoro ad altri: mandalo come Richiesta,
                      oppure prendilo tu.
                    </p>
                  ) : null}
                </div>
              );
            })}

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                onClick={() => void crea()}
                disabled={creando || bozze.length === 0}
                aria-busy={creando}
              >
                {creando ? <LoaderCircle className="animate-spin" /> : null}
                Crea {bozze.length === 1 ? "il lavoro" : `i ${bozze.length} lavori`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBozze(null)}
              >
                Torna al testo
              </Button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
