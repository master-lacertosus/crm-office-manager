/**
 * Il tema chiaro si legge davvero.
 *
 * Il tema scuro lo misuravamo da tempo; il chiaro — quello che usano tutti
 * tutto il giorno — non l'aveva mai misurato nessuno. Si dava per buono
 * perche' «il nero su bianco si legge», ma il nero su bianco e' solo la
 * prima riga: sono i grigi tenui delle date, dei conteggi e delle
 * etichette a sparire per primi, e a sparire prima su uno schermo caldo,
 * poco contrastato o visto di sbieco — cioe' nella vita vera, non sul
 * monitor buono di chi ha scelto i colori.
 *
 * Le soglie sono quelle di WCAG: 4.5 per il testo normale, 3.0 per il
 * testo grande e per gli elementi d'interfaccia. Sotto quella riga non e'
 * questione di gusto.
 *
 *   node scripts/tema-chiaro-verify.mjs
 */
import { readFileSync } from "node:fs";

const CSS = readFileSync("app/globals.css", "utf8");

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

function variabiliDi(selettore) {
  const i = CSS.indexOf(selettore + " {");
  if (i < 0) return null;
  const blocco = CSS.slice(i, CSS.indexOf("\n}", i));
  const fuori = {};
  for (const [, nome, valore] of blocco.matchAll(
    /(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    fuori[nome] = valore;
  }
  return fuori;
}

const chiaro = variabiliDi(":root");
check("Il blocco del tema chiaro esiste", chiaro !== null);
if (!chiaro) process.exit(1);

function canale(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function leggi(hex) {
  const h = hex.replace("#", "");
  const p = h.length === 3 ? h.split("").map((c) => c + c) : h.match(/../g);
  return p.slice(0, 3).map((x) => parseInt(x, 16));
}
function luminanza(hex) {
  const [r, g, b] = leggi(hex);
  return 0.2126 * canale(r) + 0.7152 * canale(g) + 0.0722 * canale(b);
}
function contrasto(a, b) {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
const val = (nome) => chiaro[nome];

console.log("\n# Il testo sui fondi\n");

/* Le soglie di WCAG, non quelle comode: 4.5 per il testo normale, 3.0 per
   quello grande e per gli elementi d'interfaccia. `--ink-faint` veste
   date e conteggi, che sono testo piccolo a tutti gli effetti. */
const COPPIE = [
  ["--ink", "--canvas", 7, "testo principale sul fondo"],
  ["--ink", "--card", 7, "titoli dei task sulle schede"],
  ["--ink-secondary", "--card", 4.5, "testo secondario sulle schede"],
  ["--ink-muted", "--card", 4.5, "testo tenue sulle schede"],
  ["--ink-faint", "--card", 3, "date e conteggi appena accennati"],
  ["--ink", "--popover", 7, "testo nei menu e negli avvisi"],
  ["--ink-secondary", "--popover", 4.5, "testo secondario negli avvisi"],
  ["--ink-muted", "--popover", 4.5, "testo tenue negli avvisi"],
  ["--card-foreground", "--card", 7, "contenuto delle schede"],
  ["--muted-foreground", "--muted", 4.5, "testo sulle zone smorzate"],
];

for (const [testo, fondo, soglia, cosa] of COPPIE) {
  if (!val(testo) || !val(fondo)) {
    check(`${cosa}`, false, `token mancante: ${!val(testo) ? testo : fondo}`);
    continue;
  }
  const r = contrasto(val(testo), val(fondo));
  check(
    `${cosa}: ${r}:1`,
    r >= soglia,
    r >= soglia ? `soglia ${soglia}` : `SOTTO la soglia di ${soglia}`,
  );
}

console.log("\n# I colori semantici\n");

for (const [testo, fondo, cosa] of [
  ["--success-text", "--success-soft", "il verde del completato"],
  ["--danger-text", "--danger-soft", "il rosso degli errori"],
  ["--warning-text", "--warning-soft", "il giallo degli avvisi"],
  ["--info-text", "--info-soft", "l'azzurro delle note"],
]) {
  if (!val(testo) || !val(fondo)) continue;
  const r = contrasto(val(testo), val(fondo));
  check(`${cosa}: ${r}:1`, r >= 4.5, r >= 4.5 ? "" : "SOTTO 4.5");
}

console.log("\n# Gli stati del task\n");

for (const stato of ["backlog", "todo", "progress", "review", "done"]) {
  const t = val(`--status-${stato}-text`);
  const f = val(`--status-${stato}-soft`);
  if (!t || !f) continue;
  const r = contrasto(t, f);
  check(`stato «${stato}»: ${r}:1`, r >= 4.5, r >= 4.5 ? "" : "SOTTO 4.5");
}

console.log("\n# Il browser sa che i colori li scegliamo noi\n");

/* Senza `color-scheme`, il browser tratta la pagina come «non dichiarata»:
   i controlli nativi (menu a tendina, campi data, barre di scorrimento)
   vengono disegnati con la combinazione del sistema — che su un PC in
   modalita' scura significa widget scuri in mezzo a una pagina chiara. E'
   anche la dichiarazione che l'auto-dark del browser guarda per decidere
   se lasciar stare una pagina che si gestisce da sola. */
check(
  "Il tema chiaro dichiara color-scheme: light",
  /:root\s*\{[^}]*color-scheme:\s*light/s.test(CSS),
  "senza, i controlli nativi seguono il sistema invece della pagina",
);
check(
  "Il tema scuro dichiara color-scheme: dark",
  /\[data-tema="scuro"\][^{]*\{[^}]*color-scheme:\s*dark/s.test(CSS),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
