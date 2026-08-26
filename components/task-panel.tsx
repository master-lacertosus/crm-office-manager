"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlarmClockOff,
  BellRing,
  ChevronLeft,
  ChevronRight,
  History,
  Link2,
  ListChecks,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  Quote,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  addDaysIso,
  dayLabel,
  diffIsoDays,
  formatDue,
  formatFullDateTime,
  formatTime,
  todayIso,
} from "@/lib/format";
import {
  CommentActions,
  CommentBody,
  DecisionBadge,
} from "@/components/comment-bits";
import { messaggioErrore } from "@/lib/errori";
import { panel, scrim } from "@/lib/motion";
import {
  puoAssegnareAdAltri,
  puoLanciareTemplate,
  puoModificareTask,
} from "@/lib/permessi";
import { updateSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { REPEAT_META } from "@/lib/types";
import type { Task, TaskRepeat } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { CollaboratorsSection } from "@/components/collaborators-section";
import { DueChip } from "@/components/due-chip";
import { MentionTextarea } from "@/components/mention-textarea";
import { PriorityBadge } from "@/components/priority-badge";
import { AvanzamentoProcesso } from "@/components/processo-avanzamento";
import { SottoTask } from "@/components/sotto-task";
import { StatusLabel } from "@/components/status-pip";
import { useToast } from "@/components/toaster";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/* Host: legge ?task=<id|new> dall'URL e monta il pannello             */
/* ------------------------------------------------------------------ */

export function TaskPanelHost() {
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  // Default: vista GRANDE (richiesta cliente). ?tv=peek forza il pannello;
  // la preferenza dell'utente viene ricordata (localStorage).
  const [expanded, setExpanded] = React.useState(
    searchParams.get("tv") !== "peek",
  );
  React.useEffect(() => {
    if (searchParams.get("tv")) return;
    queueMicrotask(() => {
      try {
        if (localStorage.getItem("task-view") === "peek") setExpanded(false);
      } catch {
        /* senza storage va bene il default */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleExpanded = React.useCallback(() => {
    setExpanded((v) => {
      try {
        localStorage.setItem("task-view", v ? "peek" : "full");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }, []);

  const close = React.useCallback(() => {
    updateSearch({ task: null, due: null });
  }, []);

  React.useEffect(() => {
    if (!taskParam) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [taskParam, close]);

  return (
    <AnimatePresence>
      {taskParam ? (
        <div className="fixed inset-0 z-40">
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
            onClick={close}
            aria-hidden
          />
          <motion.aside
            variants={panel}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={taskParam === "new" ? "Nuovo task" : "Dettaglio task"}
            className={cn(
              "absolute flex flex-col bg-white",
              expanded
                ? "inset-0 m-auto h-[min(90dvh,840px)] w-[min(1080px,95vw)] overflow-hidden rounded-3xl border border-border shadow-[0_28px_90px_rgb(15_23_42/0.24)]"
                /* 460px erano stretti per un task con descrizione, checklist
                   e commenti: si leggeva tutto in colonne di poche parole.
                   Cresce con lo schermo invece di restare fisso — su un
                   monitor da ufficio si guadagna quasi metà larghezza, su un
                   portatile resta quello di prima. */
                : "inset-y-0 right-0 w-full border-l border-border shadow-[-16px_0_56px_rgb(15_23_42/0.18)] sm:w-[460px] lg:w-[560px] xl:w-[680px] sm:rounded-l-2xl",
            )}
          >
            <PanelBody
              key={taskParam}
              taskParam={taskParam}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onClose={close}
            />
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Corpo del pannello                                                  */
/* ------------------------------------------------------------------ */

function PanelBody({
  taskParam,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  taskParam: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  const { tasks, projects, statuses } = useAppStore();
  const searchParams = useSearchParams();
  const isNew = taskParam === "new";
  const task = isNew ? null : tasks.find((t) => t.id === taskParam);
  const project = task
    ? projects.find((p) => p.id === task.project_id)
    : null;

  /* Navigazione ‹ › tra i task, nello stesso ordine di board/elenco,
     rispettando i filtri owner/progetto attivi. */
  const ownerFilter = searchParams.get("owner");
  const projectFilter = searchParams.get("project");
  const ordered = React.useMemo(() => {
    const visible = tasks.filter(
      (t) =>
        (!ownerFilter || t.owner_id === ownerFilter) &&
        (!projectFilter || t.project_id === projectFilter),
    );
    return statuses
      .flatMap((s) =>
        visible
          .filter((t) => t.status === s.key)
          .sort((a, b) => a.position - b.position),
      )
      .map((t) => t.id);
  }, [tasks, statuses, ownerFilter, projectFilter]);
  const index = task ? ordered.indexOf(task.id) : -1;

  const goTo = React.useCallback((id: string) => {
    updateSearch({ task: id, due: null }, { replace: true });
  }, []);

  React.useEffect(() => {
    if (isNew || index < 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        goTo(ordered[index - 1]);
      } else if (e.key === "ArrowRight" && index < ordered.length - 1) {
        e.preventDefault();
        goTo(ordered[index + 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew, index, ordered, goTo]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-soft pr-3 pl-5">
        {isNew || !task ? (
          <p className="text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            {isNew ? "Nuovo task" : "Dettaglio task"}
          </p>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusLabel status={task.status} />
            {task.priority === "high" ? <PriorityBadge /> : null}
            {project ? (
              <span className="hidden truncate text-[13px] text-ink-muted sm:inline">
                · {project.name}
              </span>
            ) : null}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!isNew && index >= 0 ? (
            <div className="mr-1 hidden items-center gap-0.5 sm:flex">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => goTo(ordered[index - 1])}
                disabled={index <= 0}
                aria-label="Task precedente (freccia sinistra)"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-12 text-center font-mono text-[11px] text-ink-muted">
                {index + 1} di {ordered.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => goTo(ordered[index + 1])}
                disabled={index >= ordered.length - 1}
                aria-label="Task successivo (freccia destra)"
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpanded}
            aria-label={
              expanded ? "Riduci a pannello laterale" : "Espandi al centro"
            }
            className="hidden sm:inline-flex"
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Chiudi (Esc)"
          >
            <X />
          </Button>
        </div>
      </header>

      {!isNew && !task ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium text-ink-secondary">
            Task non trovato
          </p>
          <p className="text-[13px] text-ink-muted">
            Forse è stato eliminato. Chiudi il pannello e riprova.
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
            Chiudi
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex-1",
            expanded ? "min-h-0 overflow-hidden" : "overflow-y-auto",
          )}
        >
          <TaskForm task={task ?? undefined} expanded={expanded}>
            {task ? (
              <>
                <LinksSection taskId={task.id} />
                <CommentSection taskId={task.id} />
              </>
            ) : null}
          </TaskForm>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Form del task (creazione e modifica)                                */
/* ------------------------------------------------------------------ */

/**
 * Ponte tra creazione e dettaglio: appena creato, il pannello si rimonta
 * sull'id nuovo (`key={taskParam}`) e con lui sparirebbe ogni stato di
 * conferma. L'id viaggia qui fuori per un istante, così il dettaglio nasce
 * già con la spunta «Creato».
 */
let justCreatedId: string | null = null;

type SaveKind = "created" | "saved" | null;

function TaskForm({
  task,
  expanded,
  children,
}: {
  task?: Task;
  expanded: boolean;
  children?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const {
    profiles,
    projects,
    tasks,
    currentUser,
    createTask,
    updateTask,
    statuses,
    templates,
    createTaskFromTemplate,
  } = useAppStore();
  const toast = useToast();

  const applyTemplate = async (templateId: string) => {
    const created = await createTaskFromTemplate(templateId);
    if (!created || created.length === 0) return;
    toast(
      created.length === 1
        ? `«${created[0].title}» creato dal template`
        : `Pacchetto creato: ${created.length} task collegati`,
    );
    updateSearch({ task: created[0].id, due: null }, { replace: true });
  };

  const [title, setTitle] = React.useState(task?.title ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
  const [status, setStatus] = React.useState<string>(task?.status ?? "todo");
  const [priority, setPriority] = React.useState(task?.priority ?? "normal");
  const [ownerId, setOwnerId] = React.useState(task?.owner_id ?? currentUser.id);
  const [projectId, setProjectId] = React.useState(task?.project_id ?? "");
  // «+» dal calendario: la scadenza arriva precompilata via ?due=
  const [dueDate, setDueDate] = React.useState(
    task?.due_date ?? searchParams.get("due") ?? "",
  );
  const [repeat, setRepeat] = React.useState<TaskRepeat>(task?.repeat ?? "none");

  /* Un task lo lavora chi ne risponde. Sugli altri si legge e si commenta:
     mostrare campi che il database rifiuterebbe sarebbe una promessa falsa.
     In creazione il task è di chi lo sta scrivendo, quindi sempre sì. */
  const padre = task?.parent_id
    ? (tasks.find((t) => t.id === task.parent_id) ?? null)
    : null;
  const modificabile = task
    ? puoModificareTask(task, currentUser, padre)
    : true;
  const puoRiassegnare = puoAssegnareAdAltri(currentUser);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<SaveKind>(() =>
    task && justCreatedId === task.id ? "created" : null,
  );
  const [error, setError] = React.useState<string | null>(null);

  // Il ponte vale per un solo mount: consumato, si azzera.
  React.useEffect(() => {
    justCreatedId = null;
  }, []);

  React.useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0) {
      setError("Il titolo è obbligatorio.");
      return;
    }
    setError(null);
    setSaving(true);
    const patch = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      status,
      priority,
      owner_id: ownerId,
      project_id: projectId ? projectId : null,
      due_date: dueDate ? dueDate : null,
      repeat,
    };
    /* Il `finally` non è pignoleria: il pulsante è `disabled={saving}`, e
       se un errore saltasse fuori qui in mezzo `saving` resterebbe acceso
       per sempre. Il pulsante non tornerebbe più cliccabile e non direbbe
       niente — si preme e non succede nulla, senza nemmeno un motivo da
       leggere. È il modo peggiore di fallire: sembra che l'app ignori. */
    try {
      if (task) {
        const revert = await updateTask(task.id, patch);
        setSaved("saved");
        if (revert) {
          const label = statuses.find((s) => s.key === status)?.label ?? status;
          toast(`Task spostato in «${label}»`, {
            action: { label: "Annulla", onClick: revert },
          });
        }
      } else {
        const created = await createTask(patch);
        toast(`«${created.title}» creato`);
        justCreatedId = created.id;
        // Il pannello resta aperto sul task appena nato: da qui si aggiungono
        // checklist, allegati e commenti, che in creazione non esistono ancora.
        updateSearch({ task: created.id, due: null }, { replace: true });
      }
    } catch (e) {
      setError(messaggioErrore(e, "Salvataggio non riuscito."));
    } finally {
      setSaving(false);
    }
  };

  const templatePicker =
    !task && templates.length > 0 && puoLanciareTemplate(currentUser) ? (
      <div className="space-y-2">
        <Label>Parti da un template</Label>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((tpl) => (
            <Button
              key={tpl.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyTemplate(tpl.id)}
            >
              {tpl.name}
            </Button>
          ))}
        </div>
      </div>
    ) : null;

  const titleField = (
    <div className="space-y-2">
      <Label htmlFor="task-title" className={cn(expanded && "sr-only")}>
        Titolo
      </Label>
      <Input
        id="task-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Es. Shooting still life OKTA RIG"
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "task-title-error" : undefined}
        className={cn(
          expanded &&
            "h-12 border-transparent bg-transparent px-0 text-[22px] font-bold tracking-[-0.01em] shadow-none focus-visible:ring-0",
        )}
      />
      {error ? (
        <p id="task-title-error" className="text-[13px] text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );

  const descriptionField = (
    <div className="space-y-2">
      <Label htmlFor="task-description">Descrizione</Label>
      <Textarea
        id="task-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Cosa serve per considerarlo fatto?"
        className={expanded ? "min-h-36" : "min-h-24"}
      />
    </div>
  );

  const saveRow = !modificabile ? (
    <p className="rounded-xl bg-muted px-3 py-2 text-[13px] text-ink-secondary">
      Questo task è di{" "}
      <span className="font-medium text-ink">
        {profiles.find((p) => p.id === task?.owner_id)?.full_name.split(" ")[0] ??
          "un collega"}
      </span>
      : puoi seguirlo e commentarlo. Per modificarlo chiedi a chi ne risponde
      o a un responsabile.
    </p>
  ) : (
    <div className="flex items-center gap-3">
      <Button
        type="submit"
        form="task-form"
        disabled={saving}
        aria-busy={saving}
        className={cn(expanded && "w-full")}
      >
        {saving ? <LoaderCircle className="animate-spin" /> : null}
        {task ? "Salva modifiche" : "Crea task"}
      </Button>
      {saved ? (
        <span
          role="status"
          className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1 text-[13px] font-medium text-success-text"
        >
          <span className="size-1.5 rounded-full bg-success" />
          {saved === "created" ? "Creato" : "Salvato"}
        </span>
      ) : null}
    </div>
  );

  const fieldsGrid = (
    <div className={cn("grid gap-3", expanded ? "grid-cols-1" : "grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor="task-status">Stato</Label>
          <NativeSelect
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priorità</Label>
          <NativeSelect
            id="task-priority"
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as Task["priority"])
            }
          >
            <option value="low">Bassa</option>
            <option value="normal">Normale</option>
            <option value="high">Alta</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-owner">Responsabile</Label>
          <NativeSelect
            id="task-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={!puoRiassegnare}
            title={
              puoRiassegnare
                ? undefined
                : "Assegnare il lavoro spetta ai responsabili: proponilo dalle Richieste."
            }
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
        <div className="space-y-2">
          <Label htmlFor="task-due">Scadenza</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {dueDate ? (
            <DueChip iso={dueDate} status={status} />
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-project">Progetto</Label>
          <NativeSelect
            id="task-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
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
        <div className="space-y-2">
          <Label htmlFor="task-repeat">Ripetizione</Label>
          <NativeSelect
            id="task-repeat"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as TaskRepeat)}
          >
            <option value="none">Nessuna</option>
            {Object.entries(REPEAT_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {repeat !== "none" ? (
          <p
            className={cn(
              "-mt-1 text-[13px] text-ink-muted",
              !expanded && "col-span-2",
            )}
          >
            Al completamento si ricrea da solo con la scadenza spostata di{" "}
            {REPEAT_META[repeat].phrase} (serve una scadenza). I giri già
            passati vengono saltati: la nuova scadenza non nasce mai in
            ritardo.
          </p>
        ) : null}
    </div>
  );

  if (expanded) {
    return (
      <div className="grid h-full min-h-0 lg:grid-cols-[1fr_320px]">
        <div className="min-h-0 min-w-0 space-y-6 overflow-y-auto p-6">
          <form
            id="task-form"
            onSubmit={submit}
            noValidate
            className="space-y-4"
          >
            {templatePicker}
            {titleField}
            {descriptionField}
          </form>
          <div className="[&>section]:!px-0">
            {task?.batch_id ? <AvanzamentoProcesso task={task} /> : null}
            {task ? <SottoTask task={task} /> : null}
            {task ? <ChecklistSection task={task} /> : null}
            {children}
          </div>
        </div>
        <aside className="order-first flex min-h-0 flex-col overflow-y-auto border-b border-border-soft bg-[#fafbfd] p-5 lg:order-none lg:border-b-0 lg:border-l">
          <div className="space-y-4">{fieldsGrid}</div>
          <div className="sticky bottom-0 mt-auto -mx-5 space-y-3 bg-gradient-to-t from-[#fafbfd] from-75% to-transparent px-5 pt-6 pb-1">
            {saveRow}
            {task ? <TaskMeta task={task} /> : null}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <form
        id="task-form"
        onSubmit={submit}
        noValidate
        className="space-y-4 p-5"
      >
        {templatePicker}
        {titleField}
        {fieldsGrid}
        {descriptionField}
        {saveRow}
        {task ? <TaskMeta task={task} /> : null}
      </form>
      {task?.batch_id ? <AvanzamentoProcesso task={task} /> : null}
      {task ? <SottoTask task={task} /> : null}
      {task ? <ChecklistSection task={task} /> : null}
      {children}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist: spunte vere con avanzamento (indipendenti dal Salva)     */
/* ------------------------------------------------------------------ */

function ChecklistSection({ task }: { task: Task }) {
  const { toggleChecklistItem, addChecklistItem, removeChecklistItem } =
    useAppStore();
  const [text, setText] = React.useState("");
  const items = task.checklist ?? [];
  const done = items.filter((i) => i.done).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addChecklistItem(task.id, text);
    setText("");
  };

  return (
    <section aria-label="Checklist" className="px-5 pb-2">
      <Separator className="mb-4" />
      <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-ink-secondary uppercase">
        <ListChecks className="size-3.5" />
        Checklist
        {items.length > 0 ? (
          <span className="font-mono text-[11px] font-normal text-ink-muted">
            {done}/{items.length}
          </span>
        ) : null}
      </h3>

      {items.length > 0 ? (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pct === 100 ? "bg-success" : "bg-brand-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <ul className="mt-2.5 space-y-0.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="group/check flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/50"
          >
            <input
              type="checkbox"
              id={`check-${item.id}`}
              checked={item.done}
              onChange={() => toggleChecklistItem(task.id, item.id)}
              className="size-4 shrink-0 accent-(--brand-500)"
            />
            <label
              htmlFor={`check-${item.id}`}
              className={cn(
                "min-w-0 flex-1 cursor-pointer text-sm text-ink",
                item.done && "text-ink-muted line-through",
              )}
            >
              {item.text}
            </label>
            <button
              type="button"
              onClick={() => removeChecklistItem(task.id, item.id)}
              aria-label={`Rimuovi «${item.text}»`}
              className="rounded-sm p-0.5 text-ink-faint opacity-0 outline-none transition-opacity group-hover/check:opacity-100 hover:text-danger-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Aggiungi una voce…"
          aria-label="Nuova voce di checklist"
          className="h-9 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!text.trim()}
          className="h-9"
        >
          <Plus data-icon="inline-start" />
          Aggiungi
        </Button>
      </form>
    </section>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const {
    profiles,
    currentUser,
    sendNotification,
    snoozes,
    snoozeTask,
    unsnoozeTask,
    reportProblem,
    resolveProblem,
    requests,
  } = useAppStore();
  const toast = useToast();
  const [sending, setSending] = React.useState(false);
  const [problemOpen, setProblemOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reporting, setReporting] = React.useState(false);

  const creator = profiles.find((p) => p.id === task.created_by);
  const owner = profiles.find((p) => p.id === task.owner_id);
  // Provenienza: se il task è nato da una richiesta approvata.
  const sourceRequest = requests.find((r) => r.task_id === task.id);
  const sourceRequester = sourceRequest
    ? profiles.find((p) => p.id === sourceRequest.requester_id)
    : null;
  const canRemind =
    owner && owner.id !== currentUser.id && task.status !== "done";
  const snoozedUntil = snoozes[task.id];
  const blockedDays = task.problem_since
    ? Math.max(0, diffIsoDays(task.problem_since.slice(0, 10), todayIso()))
    : 0;

  const remind = async () => {
    if (!owner) return;
    setSending(true);
    await sendNotification(
      owner.id,
      `Promemoria: il task «${task.title}» aspetta un tuo aggiornamento.`,
      task.id,
      "sollecito",
    );
    setSending(false);
    toast(`Promemoria inviato a ${owner.full_name.split(" ")[0]}`);
  };

  const submitProblem = async () => {
    setReporting(true);
    await reportProblem(task.id, reason);
    setReporting(false);
    setProblemOpen(false);
    setReason("");
    toast("Problema segnalato: admin e responsabile avvisati");
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Flusso problemi */}
      {task.status === "alert" ? (
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-danger-soft p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-danger-text uppercase">
            <TriangleAlert className="size-3.5" />
            Problema · bloccato da{" "}
            {blockedDays === 0 ? "oggi" : `${blockedDays} g`}
          </p>
          <p className="text-[13px]/[18px] text-ink">
            {task.problem_reason ?? "Motivo non indicato."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resolveProblem(task.id);
              toast("Sbloccato: il task torna In corso");
            }}
          >
            Sblocca (torna In corso)
          </Button>
        </div>
      ) : task.status !== "done" ? (
        problemOpen ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <Label htmlFor="problem-reason">Cosa blocca questo task?</Label>
            <Textarea
              id="problem-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. mancano le misure dal fornitore"
              className="min-h-16"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={submitProblem}
                disabled={reporting}
                aria-busy={reporting}
              >
                {reporting ? <LoaderCircle className="animate-spin" /> : null}
                Segnala
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProblemOpen(false)}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProblemOpen(true)}
            className="border-destructive/40 text-danger-text hover:bg-danger-soft"
          >
            <TriangleAlert data-icon="inline-start" />
            Segnala problema
          </Button>
        )
      ) : null}

      {/* Snooze personale */}
      {task.status !== "done" ? (
        snoozedUntil ? (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            <AlarmClockOff className="size-3.5" />
            Posticipato fino al {formatDue(snoozedUntil)}
            <button
              type="button"
              onClick={() => unsnoozeTask(task.id)}
              className="rounded-sm font-medium text-brand-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Annulla
            </button>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
            <AlarmClockOff className="size-3.5" />
            Posticipa:
            <button
              type="button"
              onClick={() => {
                snoozeTask(task.id, addDaysIso(1));
                toast("Posticipato a domani (solo per te)");
              }}
              className="rounded-sm font-medium text-brand-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Domani
            </button>
            ·
            <button
              type="button"
              onClick={() => {
                snoozeTask(task.id, addDaysIso(3));
                toast("Posticipato di 3 giorni (solo per te)");
              }}
              className="rounded-sm font-medium text-brand-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              +3 giorni
            </button>
          </p>
        )
      ) : null}

      <CollaboratorsSection task={task} />

      <p className="font-mono text-xs text-ink-muted">
        Creato da {creator?.full_name ?? "—"}
      </p>
      {sourceRequest ? (
        <p className="font-mono text-xs text-ink-muted">
          Nato dalla richiesta di {sourceRequester?.full_name ?? "—"} ·{" "}
          {formatDue(sourceRequest.created_at.slice(0, 10))}
        </p>
      ) : null}
      {task.status === "done" && task.completed_at ? (
        <p className="font-mono text-xs text-success-text">
          Completato il {formatDue(task.completed_at.slice(0, 10))}
        </p>
      ) : null}
      {canRemind ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={remind}
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <BellRing data-icon="inline-start" />
          )}
          Sollecita {owner.full_name.split(" ")[0]}
        </Button>
      ) : null}

      <DeleteTask task={task} />
    </div>
  );
}

/**
 * Eliminazione definitiva di un task.
 *
 * Chi può: chi l'ha creato, chi ne è responsabile, gli amministratori — le
 * stesse condizioni della policy `tasks_delete_owner_creator_admin`. Il
 * pulsante si nasconde a chi non può, ma la decisione resta del database:
 * qui si evita solo di mostrare una porta che si aprirebbe con un no.
 *
 * Non c'è annulla. Con il task se ne vanno commenti, cronologia, checklist,
 * allegati e avvisi collegati: ricostruirli sarebbe una finzione. Per far
 * sparire un task dalla board conservandone la storia c'è l'archivio, e i
 * «Fatto» ci finiscono da soli dopo 14 giorni.
 */
function DeleteTask({ task }: { task: Task }) {
  const { currentUser, deleteTask } = useAppStore();
  const toast = useToast();
  const [conferma, setConferma] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const puo =
    currentUser.role === "admin" ||
    task.created_by === currentUser.id ||
    task.owner_id === currentUser.id;
  if (!puo) return null;

  const elimina = async () => {
    setBusy(true);
    try {
      await deleteTask(task.id);
      toast(`«${task.title}» eliminato`);
      // Il pannello si chiude da solo: il task non esiste più e il suo
      // parametro nell'URL non trova nulla.
    } catch (e) {
      toast(`Non eliminato: ${messaggioErrore(e, "motivo non riportato")}`);
      setBusy(false);
      setConferma(false);
    }
  };

  if (!conferma) {
    return (
      <button
        type="button"
        onClick={() => setConferma(true)}
        className="self-start rounded-sm text-xs text-ink-muted underline-offset-2 outline-none hover:text-danger-text hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        Elimina questo task
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-danger-soft p-3">
      <p className="text-[13px] font-medium text-danger-text">
        Eliminare «{task.title}»?
      </p>
      <p className="text-[12px] text-ink-secondary">
        Spariscono anche commenti, cronologia, checklist e allegati. Non si può
        annullare. Se vuoi solo toglierlo dalla board, spostalo in «Fatto»:
        finisce in archivio da solo.
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={elimina}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          Elimina per sempre
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConferma(false)}
          disabled={busy}
        >
          Annulla
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;

function LinksSection({ taskId }: { taskId: string }) {
  const { taskLinks, addTaskLink, removeTaskLink } = useAppStore();
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const list = taskLinks.filter((l) => l.task_id === taskId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https?:\/\/\S+/.test(url.trim())) {
      setError("Serve un URL valido (https://…).");
      return;
    }
    setError(null);
    setAdding(true);
    await addTaskLink(taskId, url, label);
    setAdding(false);
    setUrl("");
    setLabel("");
  };

  return (
    <section aria-label="Allegati" className="px-5 pb-2">
      <Separator className="mb-4" />
      <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-ink-secondary uppercase">
        Allegati e link
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] font-normal text-ink-muted">
          {list.length}
        </span>
      </h3>

      <ul className="mt-3 space-y-2">
        {list.length === 0 ? (
          <li className="text-[13px] text-ink-muted">
            Nessun allegato. Incolla un link (brief, Figma, foto…).
          </li>
        ) : (
          list.map((link) => {
            const isImage = IMAGE_RE.test(link.url);
            let host = "";
            try {
              host = new URL(link.url).hostname.replace("www.", "");
            } catch {
              host = link.url;
            }
            return (
              <li key={link.id} className="group flex items-center gap-2.5">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={link.url}
                    alt=""
                    className="size-10 shrink-0 rounded-lg border border-border object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Link2 aria-hidden className="size-4 text-ink-muted" />
                  </span>
                )}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="truncate text-[13px] font-medium text-ink group-hover:underline">
                    {link.label ?? host}
                  </p>
                  <p className="truncate font-mono text-[10px] text-ink-muted">
                    {host}
                  </p>
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rimuovi ${link.label ?? host}`}
                  onClick={() => removeTaskLink(link.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })
        )}
      </ul>

      <form onSubmit={submit} noValidate className="mt-3 space-y-2">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="link-url" className="sr-only">
              URL
            </Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="w-32 space-y-2 sm:w-40">
            <Label htmlFor="link-label" className="sr-only">
              Etichetta
            </Label>
            <Input
              id="link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Etichetta"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            aria-label="Aggiungi link"
            disabled={adding || url.trim().length === 0}
            aria-busy={adding}
          >
            {adding ? <LoaderCircle className="animate-spin" /> : <Plus />}
          </Button>
        </div>
        {error ? (
          <p className="text-[13px] text-danger-text">{error}</p>
        ) : null}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Commenti                                                            */
/* ------------------------------------------------------------------ */

function CommentSection({ taskId }: { taskId: string }) {
  const { comments, events, profiles, statuses, addComment } = useAppStore();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [showActivity, setShowActivity] = React.useState(true);

  const quoteComment = (text: string, authorName: string) => {
    const excerpt = text.replace(/\n+/g, " ").slice(0, 140);
    const prefix = `> ${excerpt}${text.length > 140 ? "…" : ""} — ${authorName.split(" ")[0]}\n`;
    setBody((prev) => prefix + (prev.startsWith("> ") ? prev.replace(/^(> .*\n)+/, "") : prev));
    document.getElementById("comment-body")?.focus();
  };

  const list = comments
    .filter((c) => c.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const taskEvents = events.filter((e) => e.task_id === taskId);

  /** Cronologia e commenti fusi in un'unica timeline. */
  const timeline: (
    | { kind: "comment"; at: string; comment: (typeof list)[number] }
    | { kind: "event"; at: string; event: (typeof taskEvents)[number] }
  )[] = [
    ...list.map((comment) => ({
      kind: "comment" as const,
      at: comment.created_at,
      comment,
    })),
    ...(showActivity
      ? taskEvents.map((event) => ({
          kind: "event" as const,
          at: event.created_at,
          event,
        }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const nameOf = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name.split(" ")[0] ?? "Qualcuno";
  const statusLabel = (key: string | null | undefined) =>
    statuses.find((s) => s.key === key)?.label ?? key ?? "—";
  const priorityLabel = (key: string | null | undefined) =>
    key === "high" ? "Alta" : key === "low" ? "Bassa" : "Normale";

  const describeEvent = (ev: (typeof taskEvents)[number]): string => {
    switch (ev.type) {
      case "created":
        return `${nameOf(ev.actor_id)} ha creato il task`;
      case "status_changed":
        return `${nameOf(ev.actor_id)}: ${statusLabel(ev.from)} → ${statusLabel(ev.to)}`;
      case "due_changed":
        return `${nameOf(ev.actor_id)} ha spostato la scadenza: ${ev.from ? formatDue(ev.from) : "—"} → ${ev.to ? formatDue(ev.to) : "—"}`;
      case "owner_changed":
        return `${nameOf(ev.actor_id)} ha riassegnato a ${nameOf(ev.to ?? "")}`;
      case "priority_changed":
        return `${nameOf(ev.actor_id)}: priorità ${priorityLabel(ev.to)}`;
      case "archived":
        return "Archiviato automaticamente (Fatto da più di 14 giorni)";
      case "restored":
        return `${nameOf(ev.actor_id)} l'ha ripristinato dall'archivio`;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setSending(true);
    await addComment(taskId, body);
    setSending(false);
    setBody("");
  };

  return (
    <section aria-label="Commenti" className="px-5 pb-6">
      <Separator className="mb-4" />
      <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-ink-secondary uppercase">
        Commenti e attività
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] font-normal text-ink-muted">
          {list.length}
        </span>
        <button
          type="button"
          onClick={() => setShowActivity((v) => !v)}
          aria-pressed={showActivity}
          className="ml-auto inline-flex items-center gap-1 rounded-sm text-[11px] font-medium normal-case tracking-normal text-ink-faint outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <History className="size-3" />
          {showActivity ? "Nascondi cronologia" : "Mostra cronologia"}
        </button>
      </h3>

      <div className="mt-3 space-y-3">
        {timeline.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nessun commento. Scrivi il primo.
          </p>
        ) : (
          (() => {
            let lastDay = "";
            return timeline.map((entry) => {
              const day = entry.at.slice(0, 10);
              const showSeparator = day !== lastDay;
              lastDay = day;
              const separator = showSeparator ? (
                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-border-soft" />
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                    {dayLabel(entry.at)}
                  </span>
                  <span className="h-px flex-1 bg-border-soft" />
                </div>
              ) : null;

              if (entry.kind === "event") {
                return (
                  <React.Fragment key={entry.event.id}>
                    {separator}
                    <p className="flex items-baseline gap-2 pl-1 text-[12px] text-ink-muted">
                      <History
                        aria-hidden
                        className="size-3 shrink-0 translate-y-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        {describeEvent(entry.event)}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[10px]"
                        title={formatFullDateTime(entry.at)}
                      >
                        {formatTime(entry.at)}
                      </span>
                    </p>
                  </React.Fragment>
                );
              }

              const comment = entry.comment;
              const author = profiles.find((p) => p.id === comment.author_id);
              return (
                <React.Fragment key={comment.id}>
                  {separator}
                  <div className="group/comment flex gap-2.5">
                    <AvatarInitials
                      name={author?.full_name ?? "?"}
                      src={author?.avatar_url}
                      size="sm"
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-[13px]">
                        <span className="font-semibold text-ink">
                          {author?.full_name ?? "—"}
                        </span>
                        <span
                          className="font-mono text-[11px] text-ink-muted"
                          title={formatFullDateTime(comment.created_at)}
                        >
                          {formatTime(comment.created_at)}
                        </span>
                        {comment.is_decision ? <DecisionBadge /> : null}
                        <button
                          type="button"
                          onClick={() =>
                            quoteComment(
                              comment.body,
                              author?.full_name ?? "collega",
                            )
                          }
                          className="ml-auto inline-flex items-center gap-1 rounded-sm text-[11px] font-medium text-ink-faint opacity-0 outline-none transition-opacity group-hover/comment:opacity-100 hover:text-brand-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Quote className="size-3" />
                          Cita
                        </button>
                      </p>
                      <CommentBody body={comment.body} />
                      <CommentActions
                        scope="task"
                        commentId={comment.id}
                        authorId={comment.author_id}
                        reactions={comment.reactions}
                        isDecision={comment.is_decision}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <Label htmlFor="comment-body" className="sr-only">
          Nuovo commento
        </Label>
        <MentionTextarea
          id="comment-body"
          value={body}
          onChange={setBody}
          placeholder="Scrivi un commento… «@» per menzionare un collega o @Admin"
          className="min-h-16"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={sending || body.trim().length === 0}
          aria-busy={sending}
        >
          {sending ? <LoaderCircle className="animate-spin" /> : null}
          Commenta
        </Button>
      </form>
    </section>
  );
}
