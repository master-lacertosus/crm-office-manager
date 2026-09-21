/**
 * Una pagina che lavora lo deve far vedere.
 *
 * IL DIFETTO, segnalato dall'ufficio: «se clicco su Team non vedo nulla, non
 * si apre la pagina». Non era un link rotto, ed e' proprio per questo che
 * nessun controllo lo aveva mai visto.
 *
 * Team e Workspace hanno un cancello che decide sul SERVER se chi chiede e'
 * un responsabile -- le email e i carichi di tutti non devono arrivare al
 * browser di chi non li puo' vedere. Quel cancello legge i cookie e interroga
 * il database, quindi rende la route DINAMICA: sono le uniche due dinamiche
 * su undici pagine. Le altre nove sono prerenderizzate e si aprono
 * all'istante.
 *
 * E in Next, finche' il server non risponde, il browser resta sulla pagina da
 * cui sei partito. Senza un `loading.tsx` non c'e' NIENTE da mostrare nel
 * frattempo: si preme, e non succede niente di visibile. In mezzo a nove
 * pagine istantanee, un'attesa invisibile non si legge come un'attesa.
 *
 * LA REGOLA: ogni pagina dinamica ha il suo `loading.tsx`. Non e' un vezzo --
 * e' l'unico modo che Next offre per dire «ci sto lavorando» prima di avere
 * qualcosa da dire.
 *
 *   node scripts/attesa-verify.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`,
  );
}

/** Tutte le cartelle che contengono un page.tsx sotto app/. */
function pagine(radice) {
  const fuori = [];
  for (const voce of readdirSync(radice)) {
    const percorso = join(radice, voce);
    if (statSync(percorso).isDirectory()) {
      fuori.push(...pagine(percorso));
    } else if (voce === "page.tsx") {
      fuori.push(radice);
    }
  }
  return fuori;
}

/* Cosa rende dinamica una pagina in questa versione di Next: leggere i cookie
   o gli header, dichiararlo a mano, o -- come qui -- chiamare una funzione
   che lo fa per conto suo. `richiediResponsabile()` apre un client Supabase
   dal server, che legge i cookie. */
const SEGNALI = [
  /richiediResponsabile/,
  /from "@\/lib\/supabase\/server"/,
  /\bcookies\(\)/,
  /\bheaders\(\)/,
  /force-dynamic/,
];

const cartelle = pagine("app").filter((c) => !c.includes("api"));
const dinamiche = [];

for (const cartella of cartelle) {
  const sorgente = readFileSync(join(cartella, "page.tsx"), "utf8");
  if (SEGNALI.some((r) => r.test(sorgente))) dinamiche.push(cartella);
}

console.log(
  `\n# ${dinamiche.length} pagine dinamiche su ${cartelle.length}\n`,
);

for (const cartella of dinamiche) {
  const rotta = cartella.split("\\").join("/");
  let haAttesa = false;
  try {
    statSync(join(cartella, "loading.tsx"));
    haAttesa = true;
  } catch {
    haAttesa = false;
  }
  check(
    `${rotta} mostra qualcosa mentre lavora`,
    haAttesa,
    haAttesa
      ? ""
      : "manca loading.tsx: chi preme resta a guardare la pagina di prima, e sembra che il link non funzioni",
  );
}

/* E lo scheletro deve poter vivere anche al buio. `.skeleton` e' stata per
   mesi una primitiva documentata e inutilizzabile: fondo e luccichio erano
   due bianchi scritti a mano. */
const css = readFileSync("app/globals.css", "utf8");
const blocco = css.slice(
  css.indexOf("  .skeleton {"),
  css.indexOf("@keyframes skeleton-sweep"),
);
check(
  "Lo scheletro passa dai token, non da due bianchi",
  blocco.length > 0 && !/#(fff|ffffff|eef2f7)/i.test(blocco),
  "al buio sarebbe una barra chiara addosso a un'interfaccia scura, cioe' peggio del vuoto che sostituisce",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
