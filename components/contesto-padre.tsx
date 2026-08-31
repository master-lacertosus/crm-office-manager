"use client";

import * as React from "react";
import { CornerLeftUp } from "lucide-react";

import { contestoDelPezzo } from "@/lib/contesto";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { SearchLink } from "@/components/search-link";
import { StatusPip } from "@/components/status-pip";

/**
 * Da dove viene questo pezzo, e cosa c'era scritto nella richiesta.
 *
 * Il caso vero che ha portato qui: un lavoro con un brief lungo — chi
 * l'ha chiesto, quali prodotti, quali lingue — spezzato in tre pezzi
 * affidati a tre persone. I pezzi nascono con il solo titolo, perché è
 * il padre a contenere il perché. Chi apriva il proprio pezzo si trovava
 * davanti «Check video prodotto disponibili» e nient'altro: nessuna
 * traccia della richiesta, nessun modo di risalirci.
 *
 * Peggio: il padre appartiene a un collega, e da quando ognuno apre il
 * CRM sui propri lavori non compare nemmeno in board. Il contesto
 * esisteva, salvo e intero, ma era irraggiungibile proprio per chi
 * doveva usarlo.
 *
 * Qui il padre si vede e si apre con un clic, e la sua richiesta si
 * legge senza andarlo a cercare. Il testo non viene copiato nel pezzo:
 * resta uno solo, e se il padre lo corregge lo leggono tutti aggiornato.
 */
export function ContestoPadre({ task }: { task: Task }) {
  const { tasks, profiles } = useAppStore();

  const contesto = contestoDelPezzo(task, tasks);
  if (!contesto) return null;

  const { padre, richiesta } = contesto;
  const responsabile = profiles.find((p) => p.id === padre.owner_id);

  return (
    <section
      aria-label="Lavoro principale"
      className="rounded-xl border border-border-soft bg-surface-sunken/60 p-3"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
        <CornerLeftUp className="size-3.5" />
        Pezzo di un lavoro più grande
      </p>

      <SearchLink
        params={{ task: padre.id }}
        className="mt-1.5 flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StatusPip status={padre.status} className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {padre.title}
        </span>
        {responsabile ? (
          <AvatarInitials
            name={responsabile.full_name}
            src={responsabile.avatar_url}
            size="sm"
          />
        ) : null}
      </SearchLink>

      {richiesta ? (
        <div className="mt-1 px-1.5">
          <p className="text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            La richiesta
          </p>
          {/* Il brief per intero: troncarlo qui vorrebbe dire rimandare al
              padre proprio chi non può aprirlo comodamente. */}
          <p className="mt-1 text-sm whitespace-pre-wrap text-ink-secondary">
            {richiesta}
          </p>
        </div>
      ) : null}
    </section>
  );
}
