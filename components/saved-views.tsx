"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BookmarkPlus,
  EllipsisVertical,
  EyeOff,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { CHIAVI_FILTRO } from "@/lib/filtri";
import { pop } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import { pushSearch } from "@/lib/shallow-nav";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

/**
 * Querystring dei soli parametri di vista.
 *
 * `view` (il come si guarda) più tutti i criteri di filtro (il cosa si
 * guarda). Fuori restano `task` e `tv`, che sono il pannello aperto in quel
 * momento: una vista salvata che riapre una scheda sarebbe una sorpresa.
 *
 * L'elenco dei criteri arriva da `lib/filtri.ts` e non è ricopiato qui: il
 * giorno che se ne aggiunge uno, le viste lo salvano senza che nessuno
 * debba ricordarsi di questo file.
 */
function viewParams(searchParams: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["view", ...CHIAVI_FILTRO]) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** Quanti criteri porta una vista: si mostra sul chip, così una vista
 *  «ricca» si distingue a colpo d'occhio da una che cambia solo il layout. */
function quantiCriteri(params: string): number {
  const p = new URLSearchParams(params);
  return CHIAVI_FILTRO.filter((k) => p.get(k)).length;
}

/**
 * Viste salvate della pagina Task.
 *
 * Il ridisegno nasce da tre segnalazioni che erano la stessa cosa: «non si
 * può impostare la predefinita», «una vista attiva non si può togliere, solo
 * eliminare», «la crocetta si preme troppo facilmente».
 *
 * Non erano tre difetti di logica — tutte e tre le funzioni esistevano già.
 * Erano tre difetti di visibilità: stellina e crocetta comparivano solo al
 * passaggio del mouse, misuravano 12×12 pixel (metà del minimo raccomandato)
 * e stavano a quattro pixel l'una dall'altra; togliere una vista attiva si
 * faceva ricliccando il chip, un gesto che non si annuncia da nessuna parte.
 * Il risultato: l'unico comando che si riusciva a trovare era quello
 * distruttivo, ed era anche il più facile da premere per sbaglio.
 *
 * Ora i comandi stanno in un menu con un bersaglio vero, scritti a parole,
 * e l'eliminazione è in fondo, staccata, e chiede conferma.
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
  /* Alla creazione si decide anche se sarà il punto di partenza: è lì che
     uno ci sta pensando, non tre giorni dopo cercando una stellina. */
  const [comePartenza, setComePartenza] = React.useState(false);
  /** Quale menu è aperto. Uno solo per volta. */
  const [menuId, setMenuId] = React.useState<string | null>(null);
  /** L'eliminazione armata, dentro il menu: il secondo clic conferma. */
  const [confermaId, setConfermaId] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuId) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuId(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuId]);

  const chiudiMenu = () => {
    setMenuId(null);
    setConfermaId(null);
  };

  const current = viewParams(new URLSearchParams(searchParams));
  const canSave =
    current.length > 0 && !savedViews.some((v) => v.params === current);

  if (savedViews.length === 0 && !canSave) return null;

  const save = () => {
    const pulito = name.trim();
    if (!pulito) return;
    const id = addSavedView(pulito, current);
    if (comePartenza && id) setVistaPredefinita(id);
    toast(
      comePartenza
        ? `«${pulito}» salvata: i Task si apriranno così`
        : `Vista «${pulito}» salvata`,
    );
    setName("");
    setComePartenza(false);
    setNaming(false);
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center gap-1.5 px-4 pt-3 sm:px-6"
    >
      <span className="text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">
        Viste
      </span>

      {savedViews.map((view) => {
        const active = view.params === current;
        const diPartenza = predefinita === view.id;
        const aperto = menuId === view.id;
        const criteri = quantiCriteri(view.params);
        return (
          <span key={view.id} className="relative inline-flex">
            <button
              /* Il chip resta un interruttore: premuto applica, ripremuto
                 toglie. Ora però lo dice — «Attiva, premi per toglierla» —
                 invece di lasciarlo scoprire per caso. */
              onClick={() => pushSearch(active ? "?" : `?${view.params}`)}
              title={
                active
                  ? `«${view.name}» è attiva — premi per toglierla`
                  : `Applica «${view.name}»`
              }
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-l-full border py-1 pr-2 pl-3 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-border bg-card text-ink-secondary hover:text-ink",
              )}
            >
              {/* La stellina della vista di partenza si vede SEMPRE quando
                  c'è: è uno stato, e uno stato che si mostra solo al
                  passaggio del mouse non è uno stato, è un segreto. */}
              {diPartenza ? (
                <Star
                  aria-hidden
                  className="size-3 shrink-0 text-brand-600"
                  fill="currentColor"
                />
              ) : null}
              {view.name}
              {criteri > 0 ? (
                <span
                  aria-hidden
                  title={`${criteri} criteri`}
                  className="font-mono text-[10px] font-normal opacity-60"
                >
                  {criteri}
                </span>
              ) : null}
              {diPartenza ? (
                <span className="sr-only">— è la vista di partenza</span>
              ) : null}
            </button>

            <button
              /* Bersaglio vero: 28×26, sempre visibile, staccato dal nome.
                 Prima qui c'erano due comandi da 12×12 invisibili. */
              onClick={() => (aperto ? chiudiMenu() : setMenuId(view.id))}
              aria-expanded={aperto}
              aria-haspopup="menu"
              aria-label={`Opzioni della vista ${view.name}`}
              className={cn(
                "inline-flex w-7 items-center justify-center rounded-r-full border border-l-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "border-border bg-card text-ink-muted hover:text-ink",
              )}
            >
              <EllipsisVertical aria-hidden className="size-3.5" />
            </button>

            <AnimatePresence>
              {aperto ? (
                <motion.div
                  variants={pop}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  role="menu"
                  aria-label={`Opzioni di ${view.name}`}
                  className="glass-strong absolute top-full right-0 z-50 mt-1.5 w-[230px] origin-top-right rounded-xl p-1"
                >
                  {active ? (
                    <button
                      role="menuitem"
                      onClick={() => {
                        pushSearch("?");
                        chiudiMenu();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <EyeOff aria-hidden className="size-3.5 shrink-0" />
                      Togli questa vista
                    </button>
                  ) : null}

                  <button
                    role="menuitem"
                    onClick={() => {
                      setVistaPredefinita(diPartenza ? null : view.id);
                      toast(
                        diPartenza
                          ? "I Task si apriranno senza filtri"
                          : `I Task si apriranno su «${view.name}»`,
                      );
                      chiudiMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0",
                        diPartenza && "text-brand-600",
                      )}
                      fill={diPartenza ? "currentColor" : "none"}
                    />
                    {diPartenza
                      ? "Non aprire più i Task così"
                      : "Apri sempre i Task così"}
                  </button>

                  <div className="my-1 h-px bg-border-soft" />

                  <button
                    role="menuitem"
                    /* Due passaggi anche qui dentro. Il menu lo rende già
                       difficile da premere per sbaglio; la conferma serve
                       per il clic deciso ma sbagliato. */
                    onClick={() => {
                      if (confermaId === view.id) {
                        removeSavedView(view.id);
                        if (diPartenza) setVistaPredefinita(null);
                        toast(`Vista «${view.name}» eliminata`);
                        chiudiMenu();
                      } else {
                        setConfermaId(view.id);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      confermaId === view.id
                        ? "bg-danger-soft font-semibold text-danger-text"
                        : "text-danger-text hover:bg-danger-soft/60",
                    )}
                  >
                    {confermaId === view.id ? (
                      <>
                        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                        Premi ancora per eliminare
                      </>
                    ) : (
                      <>
                        <Trash2 aria-hidden className="size-3.5 shrink-0" />
                        Elimina la vista
                      </>
                    )}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </span>
        );
      })}

      {canSave ? (
        naming ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
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
            {/* La scelta si offre qui, nel momento in cui uno ci sta
                pensando — non nascosta in un menu da scoprire dopo. */}
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-secondary">
              <input
                type="checkbox"
                checked={comePartenza}
                onChange={(e) => setComePartenza(e.target.checked)}
                className="size-3.5 accent-brand-500"
              />
              Aprici sempre i Task
            </label>
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
