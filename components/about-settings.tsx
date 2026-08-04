"use client";

import * as React from "react";
import { Info, Keyboard, RotateCcw } from "lucide-react";

import { usePreferences } from "@/lib/preferences";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-xs border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
      {children}
    </kbd>
  );
}

const SHORTCUTS: { keys: React.ReactNode; label: string }[] = [
  {
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <span className="text-ink-faint">/</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
    label: "Comandi rapidi: cerca task, progetti, persone o un'azione",
  },
  {
    keys: (
      <>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
      </>
    ),
    label: "Naviga tra i risultati dei comandi",
  },
  { keys: <Kbd>Invio</Kbd>, label: "Apri la voce selezionata" },
  { keys: <Kbd>Esc</Kbd>, label: "Chiudi pannelli, dialoghi e la modalità standup" },
];

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-card p-3">
      <p className="font-mono text-[22px]/7 font-bold text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-muted">{label}</p>
    </div>
  );
}

export function AboutSettings() {
  const { tasks, profiles, projects, templates, customStatuses } =
    useAppStore();
  const { reset } = usePreferences();
  const toast = useToast();

  const activeTasks = tasks.filter((t) => !t.archived_at);
  const openCount = activeTasks.filter((t) => t.status !== "done").length;
  const doneCount = activeTasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          <Keyboard className="size-3.5" />
          Scorciatoie da tastiera
        </p>
        <ul className="mt-3 space-y-2.5">
          {SHORTCUTS.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-[13px] text-ink-secondary"
            >
              <span className="min-w-0">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">{s.keys}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-soft p-4">
        <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          Il tuo workspace
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat
            value={profiles.filter((p) => p.is_active).length}
            label="Membri attivi"
          />
          <Stat
            value={projects.filter((p) => !p.is_archived).length}
            label="Progetti"
          />
          <Stat value={openCount} label="Task aperti" />
          <Stat value={doneCount} label="Completati" />
          <Stat value={templates.length} label="Template" />
          <Stat value={customStatuses.length} label="Fasi custom" />
        </div>
      </section>

      <section className="card-soft p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          <Info className="size-3.5" />
          Informazioni
        </p>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Applicazione</dt>
            <dd className="font-medium text-ink">Lacertosus Office OS</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Edizione</dt>
            <dd className="font-medium text-ink">Anteprima · MVP</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Dati</dt>
            <dd className="text-right font-medium text-ink">
              Salvati in questo browser
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border-soft pt-3 text-[12px] text-ink-muted">
          Al collegamento con Supabase i dati passeranno al cloud, condivisi
          dal team, a parità di funzioni.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border p-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">
            Ripristina l&rsquo;aspetto
          </p>
          <p className="text-[12px] text-ink-muted">
            Riporta accento, densità e movimento ai valori predefiniti.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            toast("Aspetto ripristinato");
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Ripristina
        </Button>
      </div>
    </div>
  );
}
