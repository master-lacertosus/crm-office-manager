"use client";

import * as React from "react";
import { LoaderCircle, Plus, UserRoundPlus, X } from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { useToast } from "@/components/toaster";

/**
 * Chi lavora al task oltre al responsabile.
 *
 * Il responsabile resta uno solo — è la regola di prodotto in
 * `docs/CLAUDE.md`, e resta vera: questi affiancano, non rispondono del
 * risultato. Per la stessa ragione **non contano nel carico di lavoro**:
 * altrimenti lo stesso lavoro comparirebbe contato più volte e i totali di
 * squadra perderebbero senso.
 */
export function CollaboratorsSection({ task }: { task: Task }) {
  const { profiles, currentUser, toggleCollaborator } = useAppStore();
  const toast = useToast();
  const [apri, setApri] = React.useState(false);
  const [inCorso, setInCorso] = React.useState<string | null>(null);

  const collaboratori = task.collaborators ?? [];

  // Il responsabile non compare fra gli aggiungibili: la guardia del database
  // lo rifiuterebbe, e offrirlo sarebbe una porta che si apre con un no.
  const aggiungibili = profiles.filter(
    (p) =>
      p.is_active &&
      p.id !== task.owner_id &&
      !collaboratori.includes(p.id),
  );

  const cambia = async (userId: string, nome: string, aggiungi: boolean) => {
    setInCorso(userId);
    try {
      await toggleCollaborator(task.id, userId);
      toast(
        aggiungi
          ? `${nome.split(" ")[0]} aggiunto ai collaboratori`
          : `${nome.split(" ")[0]} tolto dai collaboratori`,
      );
      setApri(false);
    } catch (e) {
      toast(messaggioErrore(e, "Operazione non riuscita"));
    } finally {
      setInCorso(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        Collaboratori
      </p>

      {collaboratori.length === 0 ? (
        <p className="text-[13px] text-ink-muted">
          Nessuno. Il responsabile è {" "}
          {profiles.find((p) => p.id === task.owner_id)?.full_name.split(" ")[0] ??
            "—"}
          .
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {collaboratori.map((id) => {
            const p = profiles.find((x) => x.id === id);
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-full bg-accent py-1 pr-1 pl-1.5 text-[13px]"
              >
                <AvatarInitials
                  name={p?.full_name ?? "?"}
                  src={p?.avatar_url}
                  size="sm"
                />
                <span className="text-ink">{p?.full_name ?? "Sconosciuto"}</span>
                <button
                  type="button"
                  onClick={() => cambia(id, p?.full_name ?? "Collega", false)}
                  disabled={inCorso === id}
                  aria-label={`Togli ${p?.full_name ?? "collaboratore"}`}
                  className="rounded-full p-0.5 text-ink-muted transition-colors hover:bg-card hover:text-danger-text"
                >
                  {inCorso === id ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {aggiungibili.length > 0 ? (
        apri ? (
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-accent/50 p-2">
            {aggiungibili.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => cambia(p.id, p.full_name, true)}
                disabled={inCorso !== null}
                className="flex items-center gap-1.5 rounded-full bg-card py-1 pr-2.5 pl-1 text-[13px] text-ink outline-none transition-colors hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {inCorso === p.id ? (
                  <LoaderCircle className="size-5 animate-spin p-0.5" />
                ) : (
                  <AvatarInitials
                    name={p.full_name}
                    src={p.avatar_url}
                    size="sm"
                  />
                )}
                {p.full_name}
                {p.id === currentUser.id ? (
                  <span className="text-ink-muted">(tu)</span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setApri(false)}
              className="rounded-full px-2.5 py-1 text-[13px] text-ink-muted hover:text-ink"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setApri(true)}
            className="flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-brand-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collaboratori.length === 0 ? (
              <UserRoundPlus className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            Aggiungi qualcuno
          </button>
        )
      ) : null}

      <p className="text-[11px] text-ink-muted">
        Affiancano il responsabile e ricevono gli avvisi del task. Il carico di
        lavoro resta contato su chi ne risponde.
      </p>
    </div>
  );
}
