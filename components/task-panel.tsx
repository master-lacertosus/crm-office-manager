"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Link2,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  Quote,
  Trash2,
  X,
} from "lucide-react";

import {
  dayLabel,
  formatDue,
  formatFullDateTime,
  formatTime,
} from "@/lib/format";
import { splitMentions } from "@/lib/mentions";
import { panel, scrim } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import type { Task, TaskRepeat } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { DueChip } from "@/components/due-chip";
import { MentionTextarea } from "@/components/mention-textarea";
import { PriorityBadge } from "@/components/priority-badge";
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
  const router = useRouter();
  const pathname = usePathname();
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
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

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
                : "inset-y-0 right-0 w-full border-l border-border shadow-[-16px_0_56px_rgb(15_23_42/0.18)] sm:w-[460px] sm:rounded-l-2xl",
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
  const router = useRouter();
  const pathname = usePathname();
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

  const goTo = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("task", id);
      params.delete("due");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

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

function TaskForm({
  task,
  expanded,
  children,
}: {
  task?: Task;
  expanded: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profiles, projects, currentUser, createTask, updateTask, statuses } =
    useAppStore();

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

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2500);
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
    if (task) {
      await updateTask(task.id, patch);
      setSaving(false);
      setSaved(true);
    } else {
      const created = await createTask(patch);
      setSaving(false);
      const params = new URLSearchParams(searchParams);
      params.set("task", created.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

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

  const saveRow = (
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
          Salvato
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
            <option value="weekly">Settimanale</option>
            <option value="monthly">Mensile</option>
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
            {repeat === "weekly" ? "una settimana" : "un mese"} (serve una
            scadenza).
          </p>
        ) : null}
    </div>
  );

  if (expanded) {
    return (
      <div className="grid h-full min-h-0 lg:grid-cols-[1fr_320px]">
        <div className="min-h-0 space-y-6 overflow-y-auto p-6">
          <form
            id="task-form"
            onSubmit={submit}
            noValidate
            className="space-y-4"
          >
            {titleField}
            {descriptionField}
          </form>
          <div className="[&>section]:!px-0">{children}</div>
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
        {titleField}
        {fieldsGrid}
        {descriptionField}
        {saveRow}
        {task ? <TaskMeta task={task} /> : null}
      </form>
      {children}
    </>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const { profiles, currentUser, sendNotification } = useAppStore();
  const toast = useToast();
  const [sending, setSending] = React.useState(false);
  const creator = profiles.find((p) => p.id === task.created_by);
  const owner = profiles.find((p) => p.id === task.owner_id);
  const canRemind =
    owner && owner.id !== currentUser.id && task.status !== "done";

  const remind = async () => {
    if (!owner) return;
    setSending(true);
    await sendNotification(
      owner.id,
      `Promemoria: il task «${task.title}» aspetta un tuo aggiornamento.`,
      task.id,
    );
    setSending(false);
    toast(`Promemoria inviato a ${owner.full_name.split(" ")[0]}`);
  };

  return (
    <div className="space-y-2 pt-1">
      <p className="font-mono text-xs text-ink-muted">
        Creato da {creator?.full_name ?? "—"}
      </p>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Allegati-link (fase senza Supabase Storage: si allegano URL)        */
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

/** Testo con menzioni evidenziate. */
function MentionText({ text }: { text: string }) {
  const { profiles } = useAppStore();
  return (
    <>
      {splitMentions(text, profiles).map((part, i) =>
        part.mention ? (
          <span
            key={i}
            className="rounded-sm bg-brand-50 px-0.5 font-semibold text-brand-700"
          >
            {part.text}
          </span>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Corpo del commento: righe iniziali «> …» rese come blocco citazione. */
function CommentBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const quote: string[] = [];
  let i = 0;
  while (i < lines.length && lines[i].startsWith("> ")) {
    quote.push(lines[i].slice(2));
    i += 1;
  }
  const rest = lines.slice(i).join("\n").trim();

  return (
    <div className="mt-0.5 space-y-1.5">
      {quote.length > 0 ? (
        <blockquote className="rounded-r-lg border-l-2 border-brand-300 bg-muted/70 px-2.5 py-1.5 text-[12px]/[17px] text-ink-muted">
          <MentionText text={quote.join(" ")} />
        </blockquote>
      ) : null}
      {rest ? (
        <p className="text-[13px]/[19px] whitespace-pre-line text-ink-secondary">
          <MentionText text={rest} />
        </p>
      ) : null}
    </div>
  );
}

function CommentSection({ taskId }: { taskId: string }) {
  const { comments, profiles, addComment } = useAppStore();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const quoteComment = (text: string, authorName: string) => {
    const excerpt = text.replace(/\n+/g, " ").slice(0, 140);
    const prefix = `> ${excerpt}${text.length > 140 ? "…" : ""} — ${authorName.split(" ")[0]}\n`;
    setBody((prev) => prefix + (prev.startsWith("> ") ? prev.replace(/^(> .*\n)+/, "") : prev));
    document.getElementById("comment-body")?.focus();
  };

  const list = comments
    .filter((c) => c.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

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
        Commenti
        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] font-normal text-ink-muted">
          {list.length}
        </span>
      </h3>

      <div className="mt-3 space-y-4">
        {list.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nessun commento. Scrivi il primo.
          </p>
        ) : (
          (() => {
            let lastDay = "";
            return list.map((comment) => {
              const author = profiles.find((p) => p.id === comment.author_id);
              const day = comment.created_at.slice(0, 10);
              const showSeparator = day !== lastDay;
              lastDay = day;
              return (
                <React.Fragment key={comment.id}>
                  {showSeparator ? (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="h-px flex-1 bg-border-soft" />
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                        {dayLabel(comment.created_at)}
                      </span>
                      <span className="h-px flex-1 bg-border-soft" />
                    </div>
                  ) : null}
                  <div className="group/comment flex gap-2.5">
                    <AvatarInitials
                      name={author?.full_name ?? "?"}
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
