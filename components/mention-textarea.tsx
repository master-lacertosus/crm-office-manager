"use client";

import * as React from "react";
import { AtSign } from "lucide-react";

import { mentionTargets, type MentionTarget } from "@/lib/mentions";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AvatarInitials } from "@/components/avatar-initials";
import { Textarea } from "@/components/ui/textarea";

/**
 * Textarea con menzioni: digita «@» e scegli il collega (o @Admin) con
 * frecce + Invio. La menzione genera un avviso al destinatario.
 */
export function MentionTextarea({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const { profiles, currentUser } = useAppStore();
  const targets = React.useMemo(
    () => mentionTargets(profiles, currentUser.id),
    [profiles, currentUser.id],
  );

  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = React.useState<string | null>(null);
  const [atIndex, setAtIndex] = React.useState(0);
  const [active, setActive] = React.useState(0);

  const detect = (text: string, caret: number) => {
    const upto = text.slice(0, caret);
    const at = upto.lastIndexOf("@");
    if (at === -1) {
      setQuery(null);
      return;
    }
    const between = upto.slice(at + 1);
    if (/[\s@]/.test(between) && between.length > 0) {
      setQuery(null);
      return;
    }
    setAtIndex(at);
    setQuery(between);
    setActive(0);
  };

  const suggestions = React.useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return targets
      .filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.insert.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [query, targets]);

  const pick = (target: MentionTarget) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, atIndex) + target.insert + " " + value.slice(caret);
    onChange(next);
    setQuery(null);
    const pos = atIndex + target.insert.length + 1;
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    }, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
      />
      {query !== null && suggestions.length > 0 ? (
        <div className="glass-strong absolute bottom-full left-2 z-20 mb-1.5 w-64 overflow-hidden rounded-xl p-1">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onPointerEnter={() => setActive(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                i === active && "bg-brand-50",
              )}
            >
              {s.id === "admins" ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-100">
                  <AtSign className="size-3 text-brand-700" />
                </span>
              ) : (
                <AvatarInitials name={s.label} size="sm" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {s.insert}
                </span>
                <span className="block truncate text-[11px] text-ink-muted">
                  {s.label}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
