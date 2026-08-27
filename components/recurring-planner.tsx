"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Package, Repeat, Settings2, X } from "lucide-react";

import { nextMonthlyIso } from "@/lib/format";
import { pop, scrim } from "@/lib/motion";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { REPEAT_META } from "@/lib/types";
import type { Task } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

interface RowState {
  checked: boolean;
  due: string;
  owner: string;
}

/**
 * Pianificatore delle attività ricorrenti (solo responsabili): mostra i
 * template del workspace, segnala quelli già attivi e lancia i mancanti
 * con scadenza e responsabile regolabili al volo. Apribile anche con
 * /tasks?plan=1 (parametro auto-pulito, come il tour).
 */
export function RecurringPlanner() {
  const {
    templates,
    tasks,
    profiles,
    currentUser,
    createTaskFromTemplate,
  } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, RowState>>({});
  const [creating, setCreating] = React.useState(false);
  const wasOpenRef = React.useRef(false);

  const isAdmin = currentUser.role === "admin";

  /* Apertura via URL, con parametro rimosso subito (niente riaperture da F5) */
  const forced = searchParams.get("plan") === "1";
  React.useEffect(() => {
    if (!forced) return;
    queueMicrotask(() => setOpen(true));
    updateSearch({ plan: null }, { replace: true });
  }, [forced]);

  /* Un template è «attivo» se ha già un task aperto nato da lui */
  const activeByTemplate = React.useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      if (t.template_id && t.status !== "done" && !map.has(t.template_id)) {
        map.set(t.template_id, t);
      }
    }
    return map;
  }, [tasks]);

  /* Righe inizializzate solo all'apertura (non mentre si lavora) */
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      queueMicrotask(() => {
        const next: Record<string, RowState> = {};
        for (const tpl of templates) {
          if (activeByTemplate.has(tpl.id)) continue;
          next[tpl.id] = {
            checked: tpl.repeat !== "none",
            due: tpl.due_day !== null ? nextMonthlyIso(tpl.due_day) : "",
            owner: tpl.owner_id ?? currentUser.id,
          };
        }
        setRows(next);
      });
    }
    wasOpenRef.current = open;
  }, [open, templates, activeByTemplate, currentUser.id]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isAdmin) return null;

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const selected = Object.entries(rows).filter(
    ([id, r]) => r.checked && !activeByTemplate.has(id),
  );

  const create = async () => {
    setCreating(true);
    const created = await Promise.all(
      selected.map(([id, r]) =>
        createTaskFromTemplate(id, {
          due_date: r.due || null,
          owner_id: r.owner,
        }),
      ),
    );
    const total = created.reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
    setCreating(false);
    setOpen(false);
    toast(
      total === 1
        ? "1 task creato: è sulla board"
        : `${total} task creati: sono sulla board`,
    );
  };

  const ownerName = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name ?? "—";
  const ownerAvatar = (id: string) =>
    profiles.find((p) => p.id === id)?.avatar_url;

  /* Il dialog vive in un portal sul body: la topbar ha backdrop-blur, che
     farebbe da containing block per i discendenti position:fixed. */
  const dialog = (
    <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[75]">
            <motion.div
              variants={scrim}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              variants={pop}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-label="Attività ricorrenti"
              className="absolute inset-x-4 top-1/2 mx-auto max-h-[85dvh] max-w-2xl -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-[0_28px_90px_rgb(15_23_42/0.24)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px]/7 font-bold text-ink">
                    Attività ricorrenti
                  </h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Le attività standard del mese: quelle già in corso sono
                    spuntate, le altre le lanci da qui regolando data e
                    responsabile.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                  aria-label="Chiudi"
                >
                  <X />
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {templates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-ink-muted">
                    Nessun template definito: creane uno da Impostazioni →
                    Workspace.
                  </p>
                ) : null}

                {templates.map((tpl) => {
                  const active = activeByTemplate.get(tpl.id);
                  const isPack = (tpl.pack?.length ?? 0) > 0;
                  const cadenceLabel = isPack ? (
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3" strokeWidth={2} />
                      Processo · {tpl.pack?.length} fasi
                    </span>
                  ) : tpl.repeat !== "none" ? (
                    REPEAT_META[tpl.repeat].label
                  ) : (
                    "Una tantum"
                  );
                  if (active) {
                    const openCount = tasks.filter(
                      (t) =>
                        t.template_id === tpl.id && t.status !== "done",
                    ).length;
                    return (
                      <div
                        key={tpl.id}
                        className="flex items-center gap-3 rounded-xl border border-border-soft bg-[#fafbfd] px-3 py-2.5"
                      >
                        <CheckCircle2
                          aria-label="Già pianificata"
                          className="size-4 shrink-0 text-success"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            <span className="truncate">{tpl.name}</span>
                            {tpl.priority === "high" ? (
                              <PriorityBadge iconOnly />
                            ) : null}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {cadenceLabel}
                            {" · "}
                            {isPack && openCount > 1
                              ? `${openCount} task aperti`
                              : ownerName(active.owner_id)}
                          </span>
                        </span>
                        <DueChip iso={active.due_date} status={active.status} />
                        <AvatarInitials
                          name={ownerName(active.owner_id)}
                          src={ownerAvatar(active.owner_id)}
                          size="sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setOpen(false);
                            router.push(`/tasks?task=${active.id}`, {
                              scroll: false,
                            });
                          }}
                        >
                          Apri
                        </Button>
                      </div>
                    );
                  }

                  const r = rows[tpl.id];
                  if (!r) return null;
                  return (
                    <div
                      key={tpl.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={r.checked}
                        onChange={(e) =>
                          setRow(tpl.id, { checked: e.target.checked })
                        }
                        aria-label={`Pianifica ${tpl.name}`}
                        className="size-4 shrink-0 accent-(--brand-500)"
                      />
                      <span className="min-w-0 flex-1 basis-40">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          <span className="truncate">{tpl.name}</span>
                          {tpl.priority === "high" ? (
                            <PriorityBadge iconOnly />
                          ) : null}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {cadenceLabel}
                        </span>
                      </span>
                      <Input
                        type="date"
                        value={r.due}
                        onChange={(e) => setRow(tpl.id, { due: e.target.value })}
                        aria-label={
                          isPack
                            ? `Data àncora del pacchetto ${tpl.name}`
                            : `Scadenza per ${tpl.name}`
                        }
                        title={
                          isPack
                            ? "Data àncora: i task del pacchetto si distribuiscono attorno a questa data"
                            : undefined
                        }
                        className="h-9 w-36 shrink-0"
                      />
                      <NativeSelect
                        value={r.owner}
                        onChange={(e) =>
                          setRow(tpl.id, { owner: e.target.value })
                        }
                        aria-label={`Responsabile per ${tpl.name}`}
                        disabled={isPack}
                        title={
                          isPack
                            ? "I responsabili sono definiti nel pacchetto"
                            : undefined
                        }
                        className="h-9 w-40 shrink-0"
                      >
                        {profiles
                          .filter((p) => p.is_active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    router.push("/settings/workspace", { scroll: false });
                  }}
                >
                  <Settings2 data-icon="inline-start" />
                  Gestisci template
                </Button>
                <Button
                  onClick={create}
                  disabled={selected.length === 0 || creating}
                >
                  {creating
                    ? "Creazione…"
                    : selected.length === 1
                      ? "Crea 1 task"
                      : `Crea ${selected.length} task`}
                </Button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Repeat data-icon="inline-start" />
        <span className="hidden sm:inline">Ricorrenti</span>
      </Button>
      {typeof document !== "undefined"
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
