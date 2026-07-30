"use client";

import * as React from "react";
import { CheckSquare } from "lucide-react";

import { splitMentions } from "@/lib/mentions";
import { useAppStore, type CommentScope } from "@/lib/store";
import { REACTION_EMOJIS } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Testo con menzioni evidenziate. */
export function MentionText({ text }: { text: string }) {
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
export function CommentBody({ body }: { body: string }) {
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

/** Badge «Decisione» sul commento marcato. */
export function DecisionBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-status-done-soft px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] text-status-done-text uppercase">
      <CheckSquare className="size-3" />
      Decisione
    </span>
  );
}

/**
 * Reazioni rapide + marcatura decisione. Le reazioni con conteggio sono
 * sempre visibili; le altre (e il toggle decisione) appaiono su hover.
 */
export function CommentActions({
  scope,
  commentId,
  authorId,
  reactions,
  isDecision,
}: {
  scope: CommentScope;
  commentId: string;
  authorId: string;
  reactions?: Record<string, string[]>;
  isDecision?: boolean;
}) {
  const { currentUser, toggleReaction, toggleDecision } = useAppStore();
  const canDecide =
    currentUser.role === "admin" || currentUser.id === authorId;

  return (
    <div className="mt-1.5 flex items-center gap-1">
      {REACTION_EMOJIS.map((emoji) => {
        const users = reactions?.[emoji] ?? [];
        const mine = users.includes(currentUser.id);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggleReaction(scope, commentId, emoji)}
            aria-pressed={mine}
            aria-label={`Reazione ${emoji}`}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              users.length > 0
                ? mine
                  ? "border-brand-300 bg-brand-50"
                  : "border-border bg-white"
                : "border-transparent opacity-0 group-hover/comment:opacity-60 hover:!opacity-100 focus-visible:opacity-100",
            )}
          >
            {emoji}
            {users.length > 0 ? (
              <span className="font-mono text-[10px] text-ink-muted">
                {users.length}
              </span>
            ) : null}
          </button>
        );
      })}
      {canDecide ? (
        <button
          type="button"
          onClick={() => toggleDecision(scope, commentId)}
          aria-pressed={isDecision}
          className={cn(
            "ml-1 inline-flex h-6 items-center gap-1 rounded-full border border-transparent px-1.5 text-[11px] font-medium outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
            isDecision
              ? "text-status-done-text opacity-100"
              : "text-ink-faint opacity-0 group-hover/comment:opacity-100 hover:text-status-done-text focus-visible:opacity-100",
          )}
        >
          <CheckSquare className="size-3" />
          {isDecision ? "Decisione ✓" : "Segna decisione"}
        </button>
      ) : null}
    </div>
  );
}
