"use client";

import * as React from "react";
import { Check, Lock, Plus, Trash2 } from "lucide-react";

import { MAX_CUSTOM_STATUSES, useAppStore } from "@/lib/store";
import { CUSTOM_STATUS_PRESETS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPip } from "@/components/status-pip";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Fasi del flusso: le core (e «Problema») sono bloccate; gli admin possono
 * aggiungere fino a 3 fasi custom con colori pre-approvati. Le custom si
 * inseriscono tra «In corso» e «In revisione».
 */
export function PhaseManager() {
  const { statuses, customStatuses, addCustomStatus, removeCustomStatus, currentUser } =
    useAppStore();
  const toast = useToast();
  const [label, setLabel] = React.useState("");
  const [preset, setPreset] = React.useState(0);
  const isAdmin = currentUser.role === "admin";
  const canAdd = isAdmin && customStatuses.length < MAX_CUSTOM_STATUSES;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    if (addCustomStatus(label, preset)) {
      toast(`Fase «${label.trim()}» aggiunta alla board`);
      setLabel("");
      setPreset(0);
    }
  };

  return (
    <div className="card-soft p-4">
      <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        Fasi del flusso
      </p>
      <ul className="mt-3 space-y-1.5">
        {statuses.map((meta) => (
          <li
            key={meta.key}
            className="flex h-9 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-accent/60"
          >
            <StatusPip status={meta.key} />
            <span className="flex-1 text-sm font-medium text-ink">
              {meta.label}
            </span>
            {meta.kind === "custom" ? (
              isAdmin ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rimuovi la fase ${meta.label}`}
                  onClick={() => {
                    removeCustomStatus(meta.key);
                    toast(
                      `Fase «${meta.label}» rimossa: i task tornano in Da fare`,
                    );
                  }}
                >
                  <Trash2 />
                </Button>
              ) : null
            ) : (
              <Lock aria-label="Fase di sistema" className="size-3.5 text-ink-faint" />
            )}
          </li>
        ))}
      </ul>

      {canAdd ? (
        <form onSubmit={submit} className="mt-4 space-y-2.5 border-t border-border-soft pt-4">
          <Label htmlFor="phase-label">Nuova fase (max {MAX_CUSTOM_STATUSES})</Label>
          <div className="flex gap-2">
            <Input
              id="phase-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Es. In stampa"
              className="flex-1"
            />
            <Button type="submit" size="icon" aria-label="Aggiungi fase" disabled={!label.trim()}>
              <Plus />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {CUSTOM_STATUS_PRESETS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPreset(i)}
                aria-label={`Colore ${p.name}`}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                style={{ background: p.color }}
              >
                {preset === i ? <Check className="size-3.5 text-white" /> : null}
              </button>
            ))}
          </div>
        </form>
      ) : isAdmin ? (
        <p className="mt-3 text-[13px] text-ink-muted">
          Limite di {MAX_CUSTOM_STATUSES} fasi custom raggiunto: rimuovine una
          per aggiungerne un&rsquo;altra.
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-ink-muted">
          Solo gli admin possono modificare le fasi.
        </p>
      )}
    </div>
  );
}
