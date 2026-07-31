"use client";

import * as React from "react";
import { Link2, Package, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { REPEAT_META } from "@/lib/types";
import type {
  TaskPriority,
  TaskRepeat,
  TemplatePackItem,
  WorkspaceTemplate,
} from "@/lib/types";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Bassa",
  normal: "Normale",
  high: "Alta",
};

interface FormValues {
  name: string;
  description: string;
  owner_id: string;
  project_id: string;
  priority: TaskPriority;
  repeat: TaskRepeat;
  due_day: string;
  /** Una voce per riga: diventa la checklist del task creato. */
  checklist: string;
  /** Pacchetto: se non vuoto, il template crea questo set di task. */
  pack: TemplatePackItem[];
}

function toFormValues(tpl?: WorkspaceTemplate): FormValues {
  return {
    name: tpl?.name ?? "",
    description: tpl?.description ?? "",
    owner_id: tpl?.owner_id ?? "",
    project_id: tpl?.project_id ?? "",
    priority: tpl?.priority ?? "normal",
    repeat: tpl?.repeat ?? "monthly",
    due_day: tpl?.due_day != null ? String(tpl.due_day) : "",
    checklist: (tpl?.checklist ?? []).join("\n"),
    pack: tpl?.pack ?? [],
  };
}

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FormValues;
  onSave: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const { profiles, projects } = useAppStore();
  const [values, setValues] = React.useState(initial);
  const set = <K extends keyof FormValues>(key: K, v: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!values.name.trim()) return;
        onSave(values);
      }}
      className="mt-2 space-y-3 rounded-xl border border-border bg-[#fafbfd] p-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="tpl-name">Nome attività</Label>
        <Input
          id="tpl-name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Es. Newsletter Promo"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tpl-desc">Descrizione / checklist</Label>
        <Textarea
          id="tpl-desc"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder={"Checklist:\n- primo passo\n- secondo passo"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-owner">Responsabile predefinito</Label>
          <NativeSelect
            id="tpl-owner"
            value={values.owner_id}
            onChange={(e) => set("owner_id", e.target.value)}
          >
            <option value="">Chi crea il task</option>
            {profiles
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-project">Progetto</Label>
          <NativeSelect
            id="tpl-project"
            value={values.project_id}
            onChange={(e) => set("project_id", e.target.value)}
          >
            <option value="">Nessun progetto</option>
            {projects
              .filter((p) => !p.is_archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-repeat">Ripetizione</Label>
          <NativeSelect
            id="tpl-repeat"
            value={values.repeat}
            onChange={(e) => set("repeat", e.target.value as TaskRepeat)}
          >
            <option value="none">Nessuna (una tantum)</option>
            {Object.entries(REPEAT_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-day">Giorno del mese proposto</Label>
          <Input
            id="tpl-day"
            type="number"
            min={1}
            max={28}
            value={values.due_day}
            onChange={(e) => set("due_day", e.target.value)}
            placeholder="1–28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-priority">Priorità</Label>
          <NativeSelect
            id="tpl-priority"
            value={values.priority}
            onChange={(e) => set("priority", e.target.value as TaskPriority)}
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tpl-checklist">
          Checklist (una voce per riga, diventa spunte sul task)
        </Label>
        <Textarea
          id="tpl-checklist"
          value={values.checklist}
          onChange={(e) => set("checklist", e.target.value)}
          rows={3}
          placeholder={"Soggetto e preheader\nCTA e link tracciati\nTest invio"}
          disabled={values.pack.length > 0}
        />
      </div>

      <PackEditor
        items={values.pack}
        onChange={(pack) => set("pack", pack)}
        profiles={profiles}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!values.name.trim()}>
          Salva template
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

/** Editor del pacchetto: il template crea più task collegati, con
 *  scadenze relative alla data àncora (giorni prima/dopo). */
function PackEditor({
  items,
  onChange,
  profiles,
}: {
  items: TemplatePackItem[];
  onChange: (items: TemplatePackItem[]) => void;
  profiles: { id: string; full_name: string; is_active: boolean }[];
}) {
  const setItem = (i: number, patch: Partial<TemplatePackItem>) =>
    onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2 rounded-xl border border-border bg-white p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
        <Package className="size-3.5" />
        Pacchetto multi-task
        <span className="font-normal normal-case tracking-normal text-ink-muted">
          {items.length === 0
            ? "— vuoto: il template crea un task solo"
            : `· ${items.length} task collegati`}
        </span>
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            value={item.title}
            onChange={(e) => setItem(i, { title: e.target.value })}
            placeholder="Titolo del task"
            aria-label={`Titolo task ${i + 1} del pacchetto`}
            className="h-9 min-w-40 flex-1"
          />
          <NativeSelect
            value={item.owner_id ?? ""}
            onChange={(e) =>
              setItem(i, { owner_id: e.target.value || null })
            }
            aria-label={`Responsabile task ${i + 1}`}
            className="h-9 w-40 shrink-0"
          >
            <option value="">Chi crea</option>
            {profiles
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </NativeSelect>
          <span className="flex shrink-0 items-center gap-1.5">
            <Input
              type="number"
              value={String(item.offset_days)}
              onChange={(e) =>
                setItem(i, { offset_days: Number(e.target.value) || 0 })
              }
              aria-label={`Giorni rispetto alla data àncora, task ${i + 1}`}
              className="h-9 w-20"
            />
            <span className="text-xs text-ink-muted">gg dall&rsquo;àncora</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Rimuovi il task ${i + 1} dal pacchetto`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([...items, { title: "", owner_id: null, offset_days: 0 }])
        }
      >
        <Plus data-icon="inline-start" />
        Aggiungi task al pacchetto
      </Button>
      {items.length > 0 ? (
        <p className="text-[12px] text-ink-muted">
          Offset negativi = giorni prima della data àncora (es. −7). La
          checklist singola è disattivata quando il pacchetto è attivo.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Libreria delle attività standard: i responsabili definiscono qui i
 * template richiamabili dal pianificatore ricorrenti e dal form task.
 */
export function TemplateManager() {
  const { templates, profiles, addTemplate, updateTemplate, removeTemplate, currentUser } =
    useAppStore();
  const toast = useToast();
  const isAdmin = currentUser.role === "admin";
  /** null = chiuso · "new" = creazione · altrimenti id in modifica */
  const [editing, setEditing] = React.useState<string | null>(null);

  const ownerName = (id: string | null) =>
    id ? (profiles.find((p) => p.id === id)?.full_name ?? "—") : "Chi crea";

  const save = (id: string | null, v: FormValues) => {
    const pack = v.pack
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title.length > 0);
    const patch = {
      name: v.name.trim(),
      description: v.description.trim(),
      owner_id: v.owner_id || null,
      project_id: v.project_id || null,
      priority: v.priority,
      repeat: v.repeat,
      due_day: v.due_day ? Math.min(Math.max(Number(v.due_day), 1), 28) : null,
      checklist: v.checklist
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      pack,
    };
    if (id) {
      updateTemplate(id, patch);
      toast(`Template «${patch.name}» aggiornato`);
    } else {
      addTemplate(patch);
      toast(`Template «${patch.name}» aggiunto`);
    }
    setEditing(null);
  };

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          Template attività ricorrenti
        </p>
        {isAdmin && editing === null ? (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" />
            Nuovo template
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        Le attività standard del mese: richiamabili dal pulsante «Ricorrenti»
        nella pagina Task e come base nel form «Nuovo task».
      </p>

      {editing === "new" ? (
        <TemplateForm
          initial={toFormValues()}
          onSave={(v) => save(null, v)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-ink">
                    {tpl.name}
                  </span>
                  {tpl.priority === "high" ? <PriorityBadge iconOnly /> : null}
                  {tpl.links.length > 0 ? (
                    <Link2
                      aria-label={`${tpl.links.length} link allegati`}
                      className="size-3.5 shrink-0 text-ink-faint"
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                  <span>{ownerName(tpl.owner_id)}</span>
                  {tpl.pack && tpl.pack.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3" strokeWidth={2} />
                      Pacchetto · {tpl.pack.length} task
                    </span>
                  ) : tpl.repeat !== "none" ? (
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="size-3" strokeWidth={2} />
                      {REPEAT_META[tpl.repeat].label}
                    </span>
                  ) : (
                    <span>Una tantum</span>
                  )}
                  {tpl.due_day !== null ? (
                    <span>giorno {tpl.due_day}</span>
                  ) : null}
                </span>
              </span>
              {isAdmin ? (
                <span className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifica il template ${tpl.name}`}
                    onClick={() =>
                      setEditing((cur) => (cur === tpl.id ? null : tpl.id))
                    }
                  >
                    {editing === tpl.id ? <X /> : <Pencil />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Elimina il template ${tpl.name}`}
                    onClick={() => {
                      const revert = removeTemplate(tpl.id);
                      toast(
                        `Template «${tpl.name}» eliminato`,
                        revert
                          ? { action: { label: "Annulla", onClick: revert } }
                          : undefined,
                      );
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              ) : null}
            </div>
            {editing === tpl.id ? (
              <TemplateForm
                initial={toFormValues(tpl)}
                onSave={(v) => save(tpl.id, v)}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {!isAdmin ? (
        <p className="mt-3 text-[13px] text-ink-muted">
          Solo gli admin possono modificare i template.
        </p>
      ) : null}
    </div>
  );
}
