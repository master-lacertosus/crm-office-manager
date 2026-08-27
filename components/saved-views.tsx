"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookmarkPlus, Check, Star, X } from "lucide-react";

import { usePreferences } from "@/lib/preferences";
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
  const {
    prefs: { vistaPredefinita: predefinita },
    setVistaPredefinita,
  } = usePreferences();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  /* Quale vista ha la crocetta armata. Una sola alla volta: armarne
     un'altra disarma la precedente. */
  const [confermaId, setConfermaId] = React.useState<string | null>(null);

  /* Un'eliminazione armata e dimenticata è una trappola per il clic
     successivo: dopo tre secondi torna da sé una crocetta innocua. */
  React.useEffect(() => {
    if (!confermaId) return;
    const id = setTimeout(() => setConfermaId(null), 3000);
    return () => clearTimeout(id);
  }, [confermaId]);

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
        const daEliminare = confermaId === view.id;
        return (
          <span key={view.id} className="group/view relative">
            <button
              /* Cliccare una vista già attiva la toglie. Prima riapplicava
                 gli stessi filtri, cioè non faceva niente: per tornare a
                 vedere tutto l'unica strada era cancellare la vista. */
              onClick={() => pushSearch(active ? "?" : `?${view.params}`)}
              title={active ? "Togli questa vista" : `Applica «${view.name}»`}
              aria-pressed={active}
              className={cn(
                "rounded-full border py-1 pr-10 pl-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-border bg-card text-ink-secondary hover:text-ink",
              )}
            >
              {view.name}
            </button>
            <button
              /* La stellina: questa vista è il punto di partenza. Sta prima
                 della crocetta perché è il gesto che si fa più spesso, e
                 quello distruttivo va tenuto in fondo. */
              onClick={() =>
                setVistaPredefinita(predefinita === view.id ? null : view.id)
              }
              aria-pressed={predefinita === view.id}
              aria-label={
                predefinita === view.id
                  ? `«${view.name}» è la vista di partenza — premi per toglierla`
                  : `Apri i Task su «${view.name}»`
              }
              title={
                predefinita === view.id
                  ? "È la tua vista di partenza"
                  : "Rendila la vista di partenza"
              }
              className={cn(
                "absolute top-1/2 right-[22px] -translate-y-1/2 rounded-sm outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                predefinita === view.id
                  ? "text-brand-600 opacity-100"
                  : "text-ink-faint opacity-0 group-hover/view:opacity-100 hover:text-brand-600",
              )}
            >
              <Star
                className="size-3"
                fill={predefinita === view.id ? "currentColor" : "none"}
              />
            </button>
            <button
              /* Due passaggi, non uno. La crocetta stava a tre pixel dal
                 nome, compariva al passaggio del mouse e cancellava
                 all'istante: il gesto per applicare una vista e quello per
                 perderla erano quasi lo stesso. Il primo clic arma, il
                 secondo conferma, e dopo tre secondi si disarma da sé. */
              onClick={() => {
                if (daEliminare) {
                  removeSavedView(view.id);
                  if (predefinita === view.id) setVistaPredefinita(null);
                  setConfermaId(null);
                } else {
                  setConfermaId(view.id);
                }
              }}
              aria-label={
                daEliminare
                  ? `Conferma: elimina la vista ${view.name}`
                  : `Elimina la vista ${view.name}`
              }
              title={daEliminare ? "Premi ancora per eliminare" : "Elimina"}
              className={cn(
                "absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                daEliminare
                  ? "text-danger-text opacity-100"
                  : "text-ink-faint opacity-0 group-hover/view:opacity-100 hover:text-danger-text",
              )}
            >
              {daEliminare ? (
                <Check className="size-3" />
              ) : (
                <X className="size-3" />
              )}
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
              className="h-7 w-36 rounded-full border border-input bg-card px-3 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
