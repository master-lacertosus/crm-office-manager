/**
 * Il tema scuro si legge davvero.
 *
 * Un tema scuro fatto invertendo i colori produce un grigio slavato in cui
 * il testo secondario sparisce: tecnicamente c'e', praticamente no. E'
 * l'errore piu' comune, ed e' invisibile a chi lo scrive perche' sa gia'
 * cosa c'e' scritto.
 *
 * Qui si calcola il contrasto vero di ogni accoppiata testo/fondo, con la
 * formula di WCAG, e si pretende che stia sopra la soglia. Nessun occhio
 * di mezzo.
 *
 *   node scripts/tema-scuro-verify.mjs
 */
import { readFileSync } from "node:fs";

const CSS = readFileSync("app/globals.css", "utf8");

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/** Le variabili dichiarate dentro un selettore. */
function variabiliDi(selettore) {
  const i = CSS.indexOf(selettore + " {");
  if (i < 0) return null;
  const fine = CSS.indexOf("\n}", i);
  const blocco = CSS.slice(i, fine);
  const fuori = {};
  for (const [, nome, valore] of blocco.matchAll(
    /(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    fuori[nome] = valore;
  }
  return fuori;
}

const chiaro = variabiliDi(":root");
const scuro = variabiliDi('[data-tema="scuro"]');

check("Il blocco del tema scuro esiste", scuro !== null);
if (!scuro) process.exit(1);

/* --- La formula di WCAG --------------------------------------------- */
function canale(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminanza(hex) {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h.split("").map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * canale(n[0]) + 0.7152 * canale(n[1]) + 0.0722 * canale(n[2]);
}
function contrasto(a, b) {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

/** Prende il valore dal tema scuro, con il chiaro come ripiego: molte
 *  variabili non vengono ridefinite di proposito (l'arancio di marca). */
const val = (nome) => scuro[nome] ?? chiaro[nome];

/* --- 1. Il testo sui fondi ------------------------------------------ */
const COPPIE = [
  ["--ink", "--canvas", 7, "testo principale sul fondo"],
  ["--ink", "--card", 7, "testo principale sulle schede"],
  ["--ink-secondary", "--card", 4.5, "testo secondario sulle schede"],
  ["--ink-muted", "--card", 3.5, "testo tenue sulle schede"],
  ["--ink-faint", "--card", 2.5, "testo appena accennato"],
  ["--ink", "--popover", 7, "testo nei menu"],
  ["--card-foreground", "--card", 7, "contenuto delle schede"],
];

for (const [testo, fondo, soglia, cosa] of COPPIE) {
  const r = contrasto(val(testo), val(fondo));
  check(
    `${cosa}: ${r}:1`,
    r >= soglia,
    r >= soglia ? `soglia ${soglia}` : `sotto la soglia di ${soglia}: si legge male`,
  );
}

/* --- 2. I semantici, che sono quelli che si dimenticano ------------- */
const SEMANTICI = [
  ["--success-text", "--success-soft", "il verde del completato"],
  ["--danger-text", "--danger-soft", "il rosso degli errori"],
  ["--warning-text", "--warning-soft", "il giallo degli avvisi"],
  ["--info-text", "--info-soft", "l'azzurro delle note"],
];

for (const [testo, fondo, cosa] of SEMANTICI) {
  const r = contrasto(val(testo), val(fondo));
  check(`${cosa}: ${r}:1`, r >= 4.5, r >= 4.5 ? "" : "sotto 4.5: illeggibile sul suo fondo");
}

/* --- 3. Gli stati del task, che sono la firma visiva ---------------- */
for (const stato of ["backlog", "todo", "progress", "review", "done"]) {
  const r = contrasto(val(`--status-${stato}-text`), val(`--status-${stato}-soft`));
  check(`stato «${stato}»: ${r}:1`, r >= 4.5, r >= 4.5 ? "" : "sotto 4.5");
}

/* --- 4. Il fondo scuro e' davvero scuro ----------------------------- */
{
  const l = luminanza(val("--canvas"));
  check(
    "Il fondo e' scuro sul serio",
    l < 0.05,
    `luminanza ${Math.round(l * 1000) / 1000} — un «quasi scuro» stanca piu' del chiaro`,
  );
  check(
    "Ma non e' nero pieno",
    l > 0.002,
    "il nero assoluto fa vibrare il testo e non lascia spazio alle elevazioni",
  );
}

/* --- 5. Le schede si staccano dal fondo ----------------------------- */
{
  const r = contrasto(val("--card"), val("--canvas"));
  check(
    `Le schede si distinguono dal fondo: ${r}:1`,
    r > 1.05,
    r > 1.05 ? "" : "schede e fondo indistinguibili: la board diventa una lastra",
  );
}

/* --- 6. Nessun bianco pieno rimasto nei componenti ------------------ */
{
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const tsx = (dir, dentro = []) => {
    for (const v of readdirSync(dir)) {
      if (v === "node_modules" || v === ".next") continue;
      const p = join(dir, v);
      if (statSync(p).isDirectory()) tsx(p, dentro);
      else if (v.endsWith(".tsx")) dentro.push(p);
    }
    return dentro;
  };
  const colpevoli = [...tsx("components"), ...tsx("app")]
    .filter((f) => !f.includes("styleguide"))
    .filter((f) => /\bbg-white(?![\w/-])/.test(readFileSync(f, "utf8")));
  check(
    "Nessuna superficie e' bianca per sempre",
    colpevoli.length === 0,
    colpevoli.length === 0
      ? "tutte passano dai token"
      : colpevoli.join(", "),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
