"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";

/**
 * Preferenze personali d'aspetto — vivono nel browser (localStorage) e si
 * applicano all'app intera via variabili CSS e attributi su <html>. Con
 * Supabase potranno migrare sul profilo, a parità di forma.
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
}

const DEFAULTS: Preferences = {
  accent: "orange",
  density: "comfortable",
  reduceMotion: false,
};

/** Stop della scala brand da sovrascrivere (specchia :root in globals.css). */
const STOPS = [50, 100, 200, 300, 400, 500, 550, 600, 700, 800, 900] as const;

type Scale = Record<(typeof STOPS)[number], string>;

/** Accenti pre-validati. `orange` è il default: nessun override, vince :root. */
export const ACCENTS: {
  key: AccentKey;
  label: string;
  /** Tinta rappresentativa per il pallino nel selettore. */
  swatch: string;
  scale: Scale | null;
}[] = [
  { key: "orange", label: "Arancio", swatch: "#ff6b00", scale: null },
  {
    key: "blue",
    label: "Blu",
    swatch: "#3b82f6",
    scale: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      550: "#3178f0",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
  },
  {
    key: "indigo",
    label: "Indaco",
    swatch: "#6366f1",
    scale: {
      50: "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      300: "#a5b4fc",
      400: "#818cf8",
      500: "#6366f1",
      550: "#5457ee",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
    },
  },
  {
    key: "emerald",
    label: "Smeraldo",
    swatch: "#10b981",
    scale: {
      50: "#ecfdf5",
      100: "#d1fae5",
      200: "#a7f3d0",
      300: "#6ee7b7",
      400: "#34d399",
      500: "#10b981",
      550: "#0ca678",
      600: "#059669",
      700: "#047857",
      800: "#065f46",
      900: "#064e3b",
    },
  },
  {
    key: "rose",
    label: "Rosa",
    swatch: "#f43f5e",
    scale: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      400: "#fb7185",
      500: "#f43f5e",
      550: "#ea3457",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
    },
  },
  {
    key: "slate",
    label: "Ardesia",
    swatch: "#64748b",
    scale: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      550: "#566072",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  },
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

function applyAccent(key: AccentKey) {
  const root = document.documentElement;
  const accent = ACCENTS.find((a) => a.key === key);
  const scale = accent?.scale ?? null;
  for (const stop of STOPS) {
    if (scale) root.style.setProperty(`--brand-${stop}`, scale[stop]);
    else root.style.removeProperty(`--brand-${stop}`);
  }
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
  const loadedRef = React.useRef(false);

  // Carica una volta le preferenze salvate (post-mount: niente mismatch SSR).
  // queueMicrotask evita il setState sincrono nell'effect (come nello store).
  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {
        /* storage illeggibile: si resta sui default */
      }
      loadedRef.current = true;
    });
  }, []);

  // Applica (sempre) e persiste (solo dopo il primo caricamento).
  React.useEffect(() => {
    applyAccent(prefs.accent);
    applyDensity(prefs.density);
    applyReduceMotion(prefs.reduceMotion);
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* quota piena o storage assente: pazienza */
    }
  }, [prefs]);

  const value = React.useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
      setDensity: (density) => setPrefs((p) => ({ ...p, density })),
      setReduceMotion: (reduceMotion) =>
        setPrefs((p) => ({ ...p, reduceMotion })),
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
