"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookmarkPlus, X } from "lucide-react";

import { pushSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

/** Querystring dei soli parametri di vista (senza task/tv/due). */
function viewParams(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["owner", "project", "view"]) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return params.toString();
}

/**
 * Viste salvate della pagina Task: chip personali (persistiti in locale)
 * che riapplicano filtri e tipo di vista con un click.
 */
export function SavedViews() {
  const { savedViews, addSavedView, removeSavedView } = useAppStore();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");

  const current = viewParams(new URLSearchParams(searchParams));
  const canSave =
    current.length > 0 && !savedViews.some((v) => v.params === current);

  if (savedViews.length === 0 && !canSave) return null;

  const save = () => {
    if (!name.trim()) return;
    addSavedView(name, current);
    toast(`Vista «${name.trim()}» salvata`);
    setName("");
    setNaming(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 sm:px-6">
      <span className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
        Viste
      </span>
      {savedViews.map((view) => {
        const active = view.params === current;
        return (
          <span key={view.id} className="group/view relative">
            <button
              onClick={() => pushSearch(`?${view.params}`)}
              className={cn(
                "rounded-full border py-1 pr-6 pl-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-border bg-white text-ink-secondary hover:text-ink",
              )}
            >
              {view.name}
            </button>
            <button
              onClick={() => removeSavedView(view.id)}
              aria-label={`Elimina la vista ${view.name}`}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm text-ink-faint opacity-0 outline-none group-hover/view:opacity-100 hover:text-danger-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      {canSave ? (
        naming ? (
          <span className="flex items-center gap-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setNaming(false);
              }}
              placeholder="Nome vista…"
              autoFocus
              className="h-7 w-36 rounded-full border border-input bg-white px-3 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={save}
              disabled={!name.trim()}
              className="rounded-full bg-brand-500 px-2.5 py-1 text-[12px] font-bold text-white outline-none disabled:opacity-40"
            >
              Salva
            </button>
          </span>
        ) : (
          <button
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border py-1 pr-3 pl-2 text-[12px] font-semibold text-ink-muted outline-none transition-colors hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookmarkPlus className="size-3.5" />
            Salva vista corrente
          </button>
        )
      ) : null}
    </div>
  );
}
