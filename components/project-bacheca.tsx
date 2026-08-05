"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderCircle, MessagesSquare } from "lucide-react";

import {
  dayLabel,
  formatDue,
  formatFullDateTime,
  formatTime,
} from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { AvatarInitials } from "@/components/avatar-initials";
import {
  CommentActions,
  CommentBody,
  DecisionBadge,
  MentionText,
} from "@/components/comment-bits";
import { EmptyState } from "@/components/empty-state";
import { MentionTextarea } from "@/components/mention-textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Bacheca di progetto: discussioni a livello progetto (brief, direzioni,
 * verbali) con menzioni, reazioni e decisioni; a destra il registro delle
 * decisioni (bacheca + commenti dei task del progetto).
 */
export function ProjectBacheca({ projectId }: { projectId: string }) {
  const {
    projectComments,
    comments,
    tasks,
    profiles,
    addProjectComment,
  } = useAppStore();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const thread = projectComments
    .filter((c) => c.project_id === projectId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const projectTaskIds = new Set(
    tasks.filter((t) => t.project_id === projectId).map((t) => t.id),
  );
  const decisions = [
    ...thread
      .filter((c) => c.is_decision)
      .map((c) => ({ ...c, source: "Bacheca", taskId: null as string | null })),
    ...comments
      .filter((c) => c.is_decision && projectTaskIds.has(c.task_id))
      .map((c) => ({
        ...c,
        source: tasks.find((t) => t.id === c.task_id)?.title ?? "Task",
        taskId: c.task_id,
      })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setSending(true);
    await addProjectComment(projectId, body);
    setSending(false);
    setBody("");
  };

  let lastDay = "";

  return (
    <div className="grid flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_320px]">
      {/* Thread */}
      <section aria-label="Discussione di progetto" className="card-soft min-w-0 p-5">
        <h2 className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          Bacheca
        </h2>
        <div className="mt-3 space-y-4">
          {thread.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Nessuna discussione"
              hint="Brief, direzioni creative e verbali del progetto vivono qui."
              className="py-8"
            />
          ) : (
            thread.map((comment) => {
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
                      </p>
                      <CommentBody body={comment.body} />
                      <CommentActions
                        scope="project"
                        commentId={comment.id}
                        authorId={comment.author_id}
                        reactions={comment.reactions}
                        isDecision={comment.is_decision}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-2">
          <Label htmlFor="bacheca-body" className="sr-only">
            Nuovo messaggio in bacheca
          </Label>
          <MentionTextarea
            id="bacheca-body"
            value={body}
            onChange={setBody}
            placeholder="Scrivi alla squadra… «@» per menzionare, @Team per tutti"
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
            Pubblica
          </Button>
        </form>
      </section>

      {/* Registro decisioni */}
      <aside aria-label="Registro decisioni" className="card-soft h-fit p-5">
        <h2 className="text-[11px] font-bold tracking-[0.05em] text-ink-secondary uppercase">
          Registro decisioni
          <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-border px-1.5 font-mono text-[11px] font-normal text-ink-muted">
            {decisions.length}
          </span>
        </h2>
        {decisions.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">
            Marca un commento come «Decisione» e finisce qui: mai più «chi
            l&rsquo;aveva deciso?».
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {decisions.map((d) => {
              const author = profiles.find((p) => p.id === d.author_id);
              const inner = (
                <>
                  <p className="line-clamp-3 text-[13px]/[18px] font-medium text-ink">
                    <MentionText text={d.body} />
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-ink-muted">
                    {author?.full_name.split(" ")[0]} ·{" "}
                    {formatDue(d.created_at.slice(0, 10))} · {d.source}
                  </p>
                </>
              );
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-status-done/25 bg-status-done-soft/50 p-3"
                >
                  {d.taskId ? (
                    <Link
                      href={`/tasks?task=${d.taskId}`}
                      scroll={false}
                      className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
