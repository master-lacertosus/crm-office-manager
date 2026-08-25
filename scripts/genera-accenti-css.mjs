/**
 * Estrae le tavolozze degli accenti da lib/accenti-scale.ts e ne ricava il
 * CSS, invece di ricopiarle a mano.
 *
 * Servono in CSS perche' l'accento va applicato PRIMA del primo disegno,
 * da uno script inline di poche righe: se i valori stessero in JavaScript,
 * quello script dovrebbe portarsi dietro 66 colori. Come attributo su
 * <html>, invece, i colori restano nel foglio di stile dove vivono gli
 * altri, e lo script deve solo scrivere una parola.
 *
 *   node scripts/genera-accenti-css.mjs           stampa il CSS
 *   node scripts/genera-accenti-css.mjs --check   confronta con globals.css
 */
import { readFileSync } from "node:fs";

const sorgente = readFileSync("lib/accenti-scale.ts", "utf8");

/* La tabella e' dato puro: si legge con una lettura testuale mirata invece
   di importare un modulo client dentro Node. */
function estraiAccenti(testo) {
  const inizio = testo.indexOf("export const SCALE_ACCENTI");
  if (inizio < 0) throw new Error("SCALE_ACCENTI non trovato");
  const fine = testo.indexOf("\n];", inizio);
  const blocco = testo.slice(inizio, fine);

  const accenti = [];
  const re = /^\s{2}([a-z]+):\s*(null|\{)/gm;
  let m;
  while ((m = re.exec(blocco)) !== null) {
    if (m[2] === "null") {
      accenti.push({ key: m[1], scale: null });
      continue;
    }
    // Dalla graffa aperta fino alla sua chiusura, che sta a due spazi.
    const chiusura = blocco.indexOf("\n  }", m.index);
    const corpo = blocco.slice(m.index, chiusura);
    const scala = {};
    for (const [, stop, colore] of corpo.matchAll(/(\d+):\s*"(#[0-9a-fA-F]{3,8})"/g)) {
      scala[stop] = colore;
    }
    accenti.push({ key: m[1], scale: scala });
  }
  return accenti;
}

const accenti = estraiAccenti(sorgente);

const righe = [
  "/*",
  " * Accento interfaccia (Impostazioni > Aspetto).",
  " *",
  " * Sta qui, e non in JavaScript, perche' l'accento va applicato prima del",
  " * primo disegno: lo script inline nel <head> scrive solo l'attributo, e i",
  " * colori li trova gia' pronti. Prima venivano scritti a mano sul documento",
  " * dopo l'idratazione, e per un istante si vedeva l'arancio predefinito.",
  " *",
  " * Generato da scripts/genera-accenti-css.mjs: le tavolozze restano in",
  " * lib/accenti-scale.ts, che e' l'unica fonte.",
  " *",
  " * L'arancio non compare: e' il predefinito e vince :root, senza attributo.",
  " */",
];

for (const a of accenti) {
  if (!a.scale) continue;
  righe.push(`[data-accent="${a.key}"] {`);
  for (const [stop, colore] of Object.entries(a.scale)) {
    righe.push(`  --brand-${stop}: ${colore};`);
  }
  righe.push("}");
}

const css = righe.join("\n");

if (process.argv.includes("--check")) {
  const globals = readFileSync("app/globals.css", "utf8").replace(/\r\n/g, "\n");
  let mancanti = 0;
  for (const a of accenti) {
    if (!a.scale) continue;
    for (const [stop, colore] of Object.entries(a.scale)) {
      const atteso = `--brand-${stop}: ${colore};`;
      const blocco = globals.slice(
        globals.indexOf(`[data-accent="${a.key}"]`),
        globals.indexOf("}", globals.indexOf(`[data-accent="${a.key}"]`)),
      );
      if (!blocco.includes(atteso)) {
        mancanti++;
        console.log(`FAIL  ${a.key} ${stop}: atteso ${colore}`);
      }
    }
  }
  const totale = accenti.filter((a) => a.scale).length;
  console.log(
    mancanti === 0
      ? `PASS  ${totale} accenti, ogni colore del CSS combacia con lib/accenti-scale.ts`
      : `${mancanti} colori non combaciano`,
  );
  process.exit(mancanti === 0 ? 0 : 1);
}

console.log(css);
