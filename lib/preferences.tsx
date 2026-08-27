"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";

import { usePreferenzaSincronizzata } from "@/lib/use-preferenza";

/**
 * Preferenze personali d'aspetto. Si applicano all'app intera via variabili
 * CSS e attributi su <html>, e vivono in due posti: il browser le applica
 * subito, Supabase le fa seguire la persona fra computer diversi.
 *
 * Tre leve REALI, non decorative:
 *  - accento: sovrascrive la scala --brand-* (primary, ring, selected,
 *    sidebar ne derivano già);
 *  - densità: rimappa --spacing di Tailwind v4 → riscala tutte le spaziature;
 *  - movimento ridotto: MotionConfig + guardia CSS sulle transizioni.
 */

export type AccentKey =
  | "orange"
  | "blue"
  | "indigo"
  | "emerald"
  | "rose"
  | "slate";

export type DensityKey = "compact" | "comfortable" | "spacious";

export interface Preferences {
  accent: AccentKey;
  density: DensityKey;
  reduceMotion: boolean;
  /** Avvisare quando la board cambia per mano di qualcun altro. Resta
   *  acceso: sapere che il lavoro degli altri è arrivato è il motivo per
   *  cui la board si aggiorna da sola. Ma chi lavora concentrato su un
   *  compito ha il diritto di spegnerlo, invece di vedere comparire
   *  avvisi su task che non lo riguardano. */
  avvisiAltrui: boolean;
  /** La vista salvata da applicare aprendo i Task. `null` = nessuna. */
  vistaPredefinita: string | null;
}

const DEFAULTS: Preferences = {
  accent: "orange",
  density: "comfortable",
  reduceMotion: false,
  avvisiAltrui: true,
  vistaPredefinita: null,
};

/** Accenti selezionabili. Le tavolozze stanno in app/globals.css come
 *  `[data-accent="..."]`: vanno applicate prima del primo disegno, e da
 *  qui servono solo etichetta e pallino per il selettore. */
export const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: "orange", label: "Arancio", swatch: "#ff6b00" },
  { key: "blue", label: "Blu", swatch: "#3b82f6" },
  { key: "indigo", label: "Indaco", swatch: "#6366f1" },
  { key: "emerald", label: "Smeraldo", swatch: "#10b981" },
  { key: "rose", label: "Rosa", swatch: "#f43f5e" },
  { key: "slate", label: "Ardesia", swatch: "#64748b" },
];

export const DENSITIES: {
  key: DensityKey;
  label: string;
  hint: string;
}[] = [
  { key: "compact", label: "Compatto", hint: "Più contenuto a schermo" },
  { key: "comfortable", label: "Comodo", hint: "Spaziatura predefinita" },
  { key: "spacious", label: "Arioso", hint: "Più respiro tra gli elementi" },
];

const STORAGE_KEY = "office-prefs";

/* Le tre preferenze che cambiano l'aspetto sono attributi su <html>, e i
   valori stanno nel foglio di stile. Non e' una questione di eleganza:
   cosi' lo script nel <head> puo' applicarle prima del primo disegno
   scrivendo una parola, invece di dover portare con se' i colori. */
function applyAccent(key: AccentKey) {
  const root = document.documentElement;
  // L'arancio e' il predefinito: senza attributo vince :root.
  if (key === "orange") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", key);
}

function applyDensity(key: DensityKey) {
  const root = document.documentElement;
  if (key === "comfortable") root.removeAttribute("data-density");
  else root.setAttribute("data-density", key);
}

function applyReduceMotion(on: boolean) {
  const root = document.documentElement;
  if (on) root.setAttribute("data-reduce-motion", "1");
  else root.removeAttribute("data-reduce-motion");
}

interface PreferencesContextValue {
  prefs: Preferences;
  setAccent: (accent: AccentKey) => void;
  setDensity: (density: DensityKey) => void;
  setReduceMotion: (on: boolean) => void;
  setAvvisiAltrui: (on: boolean) => void;
  setVistaPredefinita: (id: string | null) => void;
  reset: () => void;
}

const PreferencesContext =
  React.createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = React.useState<Preferences>(DEFAULTS);

  /* Browser per l'applicazione immediata, database per la portabilità: lo
     stesso meccanismo del layout della dashboard e delle fasi compresse,
     scritto una volta sola in `usePreferenzaSincronizzata`. */
  usePreferenzaSincronizzata<Preferences>(
    STORAGE_KEY,
    "appearance",
    prefs,
    (v) => setPrefs((p) => ({ ...p, ...v })),
    // I valori salvati si fondono con i predefiniti: una preferenza aggiunta
    // dopo non deve trovarsi indefinita in un salvataggio più vecchio.
    (grezzo) =>
      grezzo && typeof grezzo === "object"
        ? { ...DEFAULTS, ...(grezzo as Partial<Preferences>) }
        : null,
  );

  // L'applicazione al documento resta un effetto a sé: è una scrittura sul
  // DOM, non una persistenza.
  React.useEffect(() => {
    applyAccent(prefs.accent);
    applyDensity(prefs.density);
    applyReduceMotion(prefs.reduceMotion);
  }, [prefs]);

  const value = React.useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
      setDensity: (density) => setPrefs((p) => ({ ...p, density })),
      setReduceMotion: (reduceMotion) =>
        setPrefs((p) => ({ ...p, reduceMotion })),
      setAvvisiAltrui: (avvisiAltrui) =>
        setPrefs((p) => ({ ...p, avvisiAltrui })),
      setVistaPredefinita: (vistaPredefinita) =>
        setPrefs((p) => ({ ...p, vistaPredefinita })),
      reset: () => setPrefs(DEFAULTS),
    }),
    [prefs],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = React.useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences va usato dentro PreferencesProvider");
  }
  return ctx;
}
