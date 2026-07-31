"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Search } from "lucide-react";

import { formatDue } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/**
 * Archivio dei task completati: i «Fatto» escono dalla board dopo 14
 * giorni ma restano qui (e nei report). Ricercabile, con ripristino.
 */
export function ArchiveView() {
  const { tasks, profiles, projects, restoreTask } = useAppStore();
  const toast = useToast();
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const archived = tasks
    .filter((t) => t.archived_at)
    .filter(
      (t) =>
        !q ||
        t.title.toLowerCase().includes(q) ||
        (projects.find((p) => p.id === t.project_id)?.name ?? "")
          .toLowerCase()
          .includes(q) ||
        (profiles.find((p) => p.id === t.owner_id)?.full_name ?? "")
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
    );

  return (
    <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm text-ink-secondary">
          <Archive className="size-4 text-ink-muted" />
          I task completati escono dalla board dopo 14 giorni, ma restano qui
          e nei report.
        </p>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo, progetto, persona…"
            aria-label="Cerca nell'archivio"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {archived.length === 0 ? (
        <p className="card-soft px-4 py-10 text-center text-[13px] text-ink-muted">
          {q
            ? "Nessun task archiviato corrisponde alla ricerca."
            : "L'archivio è vuoto: i task completati arrivano qui dopo 14 giorni."}
        </p>
      ) : (
        <div className="card-soft overflow-hidden">
          {archived.map((task) => {
            const owner = profiles.find((p) => p.id === task.owner_id);
            const project = projects.find((p) => p.id === task.project_id);
            return (
              <div
                key={task.id}
                className="flex h-12 items-center gap-3 border-t border-border-soft px-3 first:border-t-0 sm:px-4"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {task.title}
                </span>
                {project ? (
                  <Badge className="hidden md:inline-flex">
                    {project.name}
                  </Badge>
                ) : null}
                <span className="hidden shrink-0 font-mono text-xs text-ink-muted sm:inline">
                  {task.completed_at
                    ? `fatto il ${formatDue(task.completed_at.slice(0, 10))}`
                    : "—"}
                </span>
                {owner ? (
                  <AvatarInitials name={owner.full_name} size="sm" />
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    restoreTask(task.id);
                    toast(`«${task.title}» ripristinato nella board (Fatto)`);
                  }}
                >
                  <ArchiveRestore data-icon="inline-start" />
                  Ripristina
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <p className="font-mono text-xs text-ink-muted">
        {archived.length} task in archivio
      </p>
    </div>
  );
}
