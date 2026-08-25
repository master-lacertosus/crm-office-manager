/**
 * Le tavolozze degli accenti: fonte unica, letta a mano.
 *
 * Non e' importato da nessun componente, di proposito. I colori servono
 * al foglio di stile, dove l'accento si applica come attributo su <html>
 * prima del primo disegno; spedirli anche al browser dentro il bundle
 * sarebbe peso morto: nessuno li leggerebbe.
 *
 * Da qui `scripts/genera-accenti-css.mjs` ricava i blocchi
 * `[data-accent="..."]` di app/globals.css, e con --check verifica che
 * i due restino allineati.
 */

export const SCALE_ACCENTI: Record<string, Record<string, string> | null> = {
  orange: null,
  blue: {
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
  indigo: {
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
  emerald: {
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
  rose: {
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
  slate: {
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
};
