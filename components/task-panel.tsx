"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing,
  Link2,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { formatDue, timeAgo } from "@/lib/format";
import { splitMentions } from "@/lib/mentions";
import { panel, scrim } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import {
  STATUS_ORDER,
  type Task,
  type TaskRepeat,
  type TaskStatus,
} from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { MentionTextarea } from "@/components/mention-textarea";
import { TASK_STATUSES } from "@/components/status-pip";
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
  const [expanded, setExpanded] = React.useState(
    searchParams.get("tv") === "full",
  );

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
            className="absolute inset-0 bg-scrim"
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
              "glass-strong absolute flex flex-col",
              expanded
                ? "inset-0 m-auto h-[min(90dvh,840px)] w-[min(1080px,95vw)] rounded-3xl"
                : "inset-y-0 right-0 w-full sm:w-[460px] sm:rounded-l-2xl",
            )}
          >
            <PanelBody
              key={taskParam}
              taskParam={taskParam}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((v) => !v)}
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
  const { tasks } = useAppStore();
  const isNew = taskParam === "new";
  const task = isNew ? null : tasks.find((t) => t.id === taskParam);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft pr-3 pl-5">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          {isNew ? "Nuovo task" : "Dettaglio task"}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpanded}
            aria-label={
              expanded ? "Riduci a pannello" : "Espandi a schermo intero"
            }
            className="hidden sm:inline-flex"
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Chiudi pannello"
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
        <div className="flex-1 overflow-y-auto">
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
  const { profiles, projects, currentUser, createTask, updateTask } =
    useAppStore();

  const [title, setTitle] = React.useState(task?.title ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
  const [status, setStatus] = React.useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = React.useState(task?.priority ?? "normal");
  const [ownerId, setOwnerId] = React.useState(task?.owner_id ?? currentUser.id);
  const [projectId, setProjectId] = React.useState(task?.project_id ?? "");
  const [dueDate, setDueDate] = React.useState(task?.due_date ?? "");
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
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUSES[s].label}
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
      <div className="grid min-h-full lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 p-6 lg:border-r lg:border-border-soft">
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
        <aside className="order-first space-y-4 border-b border-border-soft p-5 lg:order-none lg:border-b-0">
          {fieldsGrid}
          {saveRow}
          {task ? <TaskMeta task={task} /> : null}
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
      <h3 className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Allegati e link · {list.length}
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
  const { comments, profiles, addComment } = useAppStore();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

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
      <h3 className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Commenti · {list.length}
      </h3>

      <div className="mt-3 space-y-4">
        {list.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            Nessun commento. Scrivi il primo.
          </p>
        ) : (
          list.map((comment) => {
            const author = profiles.find((p) => p.id === comment.author_id);
            return (
              <div key={comment.id} className="flex gap-2.5">
                <AvatarInitials name={author?.full_name ?? "?"} size="sm" />
                <div className="min-w-0">
                  <p className="text-[13px]">
                    <span className="font-medium text-ink">
                      {author?.full_name ?? "—"}
                    </span>{" "}
                    <span className="font-mono text-xs text-ink-muted">
                      {timeAgo(comment.created_at)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px]/[19px] text-ink-secondary">
                    {splitMentions(comment.body, profiles).map((part, i) =>
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
                  </p>
                </div>
              </div>
            );
          })
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
