/**
 * Verifica dei contrasti WCAG dei token (docs/design-system.md §10).
 * Uso: node scripts/check-contrast.mjs
 * Soglie: testo 4.5:1 · testo large e componenti UI 3:1.
 */

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)
    .map((h) => parseInt(h, 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const T = {
  white: "#ffffff",
  canvas: "#f7f7f8",
  ink: "#212327",
  inkSecondary: "#5a5e66",
  inkMuted: "#696e76",
  muted: "#f1f1f3",
  brand50: "#fdf6ec",
  brand500: "#f09226",
  brand600: "#d97706",
  brand700: "#b45309",
  destructive: "#d92d20",
  dangerSoft: "#fdebe9",
  dangerText: "#b42318",
  success: "#16a34a",
  successSoft: "#eaf7ef",
  successText: "#15803d",
  warningSoft: "#fbf3d9",
  warningText: "#8a6a0b",
  infoSoft: "#eff4ff",
  infoText: "#2563eb",
};

// [descrizione, colore, sfondo, soglia]
const checks = [
  ["ink su surface", T.ink, T.white, 4.5],
  ["ink su canvas", T.ink, T.canvas, 4.5],
  ["ink-secondary su surface", T.inkSecondary, T.white, 4.5],
  ["ink-muted su surface", T.inkMuted, T.white, 4.5],
  ["ink-muted su canvas", T.inkMuted, T.canvas, 4.5],
  ["ink-secondary su muted (badge)", T.inkSecondary, T.muted, 4.5],
  ["grafite su arancio (bottone primario)", T.ink, T.brand500, 4.5],
  ["bianco su destructive (bottone)", T.white, T.destructive, 4.5],
  ["brand-700 su surface (link)", T.brand700, T.white, 4.5],
  ["brand-700 su brand-50 (badge brand)", T.brand700, T.brand50, 4.5],
  ["success-text su surface", T.successText, T.white, 4.5],
  ["success-text su success-soft", T.successText, T.successSoft, 4.5],
  ["danger-text su surface", T.dangerText, T.white, 4.5],
  ["danger-text su danger-soft", T.dangerText, T.dangerSoft, 4.5],
  ["warning-text su warning-soft", T.warningText, T.warningSoft, 4.5],
  ["info-text su info-soft", T.infoText, T.infoSoft, 4.5],
  ["ring brand-600 su surface (UI 3:1)", T.brand600, T.white, 3],
  ["tacca in-review brand-600 (UI 3:1)", T.brand600, T.white, 3],
  ["spunta bianca su done (UI 3:1)", T.white, T.success, 3],
];

let failed = 0;
for (const [name, fg, bg, min] of checks) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2).padStart(5)}:1  (min ${min})  ${name}`,
  );
}

console.log(
  failed === 0
    ? `\nTutte le ${checks.length} combinazioni rispettano la soglia.`
    : `\n${failed} combinazioni sotto soglia.`,
);
process.exit(failed === 0 ? 0 : 1);
