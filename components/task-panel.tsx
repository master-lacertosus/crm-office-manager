"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, X } from "lucide-react";

import { formatDue, timeAgo } from "@/lib/format";
import { panel, scrim } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import { STATUS_ORDER, type Task, type TaskStatus } from "@/lib/types";
import { AvatarInitials } from "@/components/avatar-initials";
import { TASK_STATUSES } from "@/components/status-pip";
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
            className="absolute inset-y-0 right-0 flex w-full flex-col bg-card shadow-md sm:w-[440px] sm:rounded-l-xl"
          >
            <PanelBody
              key={taskParam}
              taskParam={taskParam}
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
  onClose,
}: {
  taskParam: string;
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Chiudi pannello"
        >
          <X />
        </Button>
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
          <TaskForm task={task ?? undefined} />
          {task ? <CommentSection taskId={task.id} /> : null}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Form del task (creazione e modifica)                                */
/* ------------------------------------------------------------------ */

function TaskForm({ task }: { task?: Task }) {
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

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-5">
      <div className="space-y-2">
        <Label htmlFor="task-title">Titolo</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es. Shooting still life OKTA RIG"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-title-error" : undefined}
        />
        {error ? (
          <p id="task-title-error" className="text-[13px] text-danger-text">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div className="col-span-2 space-y-2">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Descrizione</Label>
        <Textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Cosa serve per considerarlo fatto?"
          className="min-h-24"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} aria-busy={saving}>
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

      {task ? <TaskMeta task={task} /> : null}
    </form>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const { profiles } = useAppStore();
  const creator = profiles.find((p) => p.id === task.created_by);
  return (
    <div className="space-y-1 pt-1">
      <p className="font-mono text-xs text-ink-muted">
        Creato da {creator?.full_name ?? "—"}
      </p>
      {task.status === "done" && task.completed_at ? (
        <p className="font-mono text-xs text-success-text">
          Completato il {formatDue(task.completed_at.slice(0, 10))}
        </p>
      ) : null}
    </div>
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
                    {comment.body}
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
        <Textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrivi un commento…"
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
