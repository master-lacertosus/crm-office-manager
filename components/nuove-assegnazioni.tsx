"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Inbox, X } from "lucide-react";

import { daMostrare, destinazione, frase } from "@/lib/assegnazioni";
import { rise } from "@/lib/motion";
import { useAppStore } from "@/lib/store";

/**
 * «Ti sono arrivati tre lavori».
 *
 * Una task assegnata compariva nella board senza dire niente: chi assegnava
 * lo dava per detto, chi riceveva se ne accorgeva solo passando di lì. Il
 * lavoro arrivava in silenzio, e il silenzio si scambia per «non c'è niente
 * da fare».
 *
 * Sta nella shell e non nella pagina Task di proposito: chi apre l'app sulla
 * Dashboard o sul Calendario deve vederlo lo stesso — un avviso che si mostra
 * solo dove saresti andato comunque non avvisa nessuno.
 *
 * Gli avvisi li scrive il database (migrazione M14), quindi arrivano anche a
 * chi in quel momento aveva l'app chiusa: li trova al primo accesso.
 */
export function NuoveAssegnazioni() {
  const { nuoveAssegnazioni, tasks, currentUser, markAssegnazioniRead } =
    useAppStore();
  /* Quali ho messo via, non quante — il perché sta in `daMostrare`. */
  const [messeVia, setMesseVia] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const daVedere = daMostrare(nuoveAssegnazioni, messeVia);
  const quante = daVedere.length;

  /* I titoli veri, non il testo dell'avviso: dice la stessa cosa in meno
     parole, e resta giusto se qualcuno rinomina il lavoro dopo averlo
     assegnato. Un task appena arrivato può non essere ancora nella lista
     locale (l'avviso e la riga viaggiano su due tabelle): in quel caso lo si
     salta invece di scrivere «Task». */
  const titoli = daVedere
    .map((n) => tasks.find((t) => t.id === n.task_id)?.title)
    .filter((t): t is string => Boolean(t));

  const una = quante === 1;

  /* Il «niente da mostrare» sta DENTRO l'AnimatePresence, non in un ritorno
     anticipato: uscendo dal componente prima di montarlo, la striscia
     sparirebbe di scatto e il `variants.exit` non verrebbe mai usato. */
  return (
    <AnimatePresence initial={false}>
      {quante > 0 ? (
        <motion.div
          key="nuove-assegnazioni"
          variants={rise}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 border-b border-brand-500/25 bg-brand-50 px-4 py-2.5 sm:px-6 print:hidden"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-primary-foreground shadow-xs"
          >
            <Inbox className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              {frase(quante)}
            </p>
            {titoli.length > 0 ? (
              <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                {titoli.slice(0, 3).join(" · ")}
                {titoli.length > 3 ? ` · +${titoli.length - 3}` : ""}
              </p>
            ) : null}
          </div>

          <Link
            href={destinazione(daVedere, currentUser.id)}
            onClick={markAssegnazioniRead}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-[13px] font-semibold text-primary-foreground outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-brand-50"
          >
            {una ? "Aprila" : "Guardale"}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>

          <button
            type="button"
            onClick={() =>
              setMesseVia(new Set(nuoveAssegnazioni.map((n) => n.id)))
            }
            aria-label="Nascondi l'avviso: le task restano nella campanella"
            className="shrink-0 rounded-lg p-1.5 text-ink-muted outline-none transition-colors hover:bg-brand-500/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
