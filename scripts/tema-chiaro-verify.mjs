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

console.log("\n# Il contrasto alto contrasta davvero\n");

/* Un interruttore che promette leggibilità e non la consegna è peggio che
   non averlo: chi lo accende ha già un problema, e resterebbe convinto di
   averlo risolto. Qui si pretende che ogni livello di testo arrivi almeno
   a 7:1 — la soglia AAA — sul fondo delle schede, in entrambi i temi. */
const alto = variabiliDi('[data-contrasto="alto"]');
check("Il blocco del contrasto alto esiste", alto !== null);

if (alto) {
  for (const nome of ["--ink-secondary", "--ink-muted", "--ink-faint"]) {
    const prima = contrasto(chiaro[nome], chiaro["--card"]);
    const dopo = contrasto(alto[nome], chiaro["--card"]);
    check(
      `${nome}: ${prima}:1 -> ${dopo}:1`,
      dopo >= 7 && dopo > prima,
      dopo >= 7 ? "" : "il contrasto alto deve arrivare almeno a 7:1",
    );
  }

  const scuro = variabiliDi('[data-tema="scuro"]');
  const scuroAlto = variabiliDi('[data-contrasto="alto"][data-tema="scuro"]');
  check("Vale anche sul tema scuro", scuroAlto !== null);
  if (scuroAlto && scuro) {
    for (const nome of ["--ink-secondary", "--ink-muted", "--ink-faint"]) {
      const dopo = contrasto(scuroAlto[nome], scuro["--card"]);
      check(`scuro ${nome}: ${dopo}:1`, dopo >= 7, dopo >= 7 ? "" : "sotto 7:1");
    }
  }
}

/* ------------------------------------------------------------------ */
console.log("\n# Il testo sopra l'accento\n");
/* ------------------------------------------------------------------ */

/*
 * Il difetto piu' vecchio del prodotto, e il piu' facile da non vedere.
 *
 * docs/design-system.md:34 prescrive «testo grafite su arancio (6,4:1)», e il
 * tema scuro lo faceva. Il tema chiaro no: `--primary-foreground: #ffffff`
 * sull'arancio di marca fa 2,86:1, con accanto un commento che lo chiamava
 * «deviazione consapevole, ~3.2:1» — una misura ottimistica su una soglia che
 * lo stesso documento, alla riga 330, chiama non negoziabile. Lo stesso
 * bottone seguiva due regole, e quella usata di giorno era quella sbagliata.
 *
 * E il grigio non e' la risposta per tutti: sull'indaco e sull'ardesia vince
 * il bianco. Per questo il colore si MISURA, accento per accento, invece di
 * deciderlo una volta e ricopiarlo.
 */
const ACCENTI_DA_MISURARE = [
  { nome: "arancio (predefinito)", selettore: ":root" },
  { nome: "blu", selettore: '[data-accent="blue"]' },
  { nome: "indaco", selettore: '[data-accent="indigo"]' },
  { nome: "smeraldo", selettore: '[data-accent="emerald"]' },
  { nome: "rosa", selettore: '[data-accent="rose"]' },
  { nome: "ardesia", selettore: '[data-accent="slate"]' },
];

for (const a of ACCENTI_DA_MISURARE) {
  const vars = variabiliDi(a.selettore);
  const fondo = vars?.["--brand-500"];
  const testo = vars?.["--primary-foreground"];
  if (!fondo || !testo) {
    check(`${a.nome}: fondo e testo dichiarati`, false, `manca in ${a.selettore}`);
    continue;
  }
  const mio = contrasto(testo, fondo);
  const alternativo = contrasto(testo === "#ffffff" ? "#111827" : "#ffffff", fondo);
  check(
    `${a.nome}: ${testo} su ${fondo} = ${mio}:1`,
    mio >= alternativo,
    mio >= alternativo
      ? ""
      : `l'altro inchiostro farebbe ${alternativo}:1 — si misura, non si sceglie`,
  );
}

/* Il tema scuro NON deve ridefinire questo token: il fondo su cui sta il
   testo e' l'accento, e l'accento di notte e' identico. Ridefinirlo qui
   vincerebbe sui blocchi [data-accent], che nel file arrivano prima. */
check(
  "Il tema scuro non sovrascrive il testo dell'accento",
  variabiliDi('[data-tema="scuro"]')?.["--primary-foreground"] === undefined,
  "il colore dipende dall'accento, non dalla luce della stanza: ridefinirlo qui riporterebbe il grafite sull'indaco e sull'ardesia, dove la misura dice bianco",
);

/*
 * E nessuno deve riscrivere il bianco a mano.
 *
 * La prima versione di questo controllo cercava «un fondo di marca e
 * text-white sulla stessa riga». Sembrava una rete e non lo era: una
 * revisione l'ha messa alla prova e ha trovato cinque cose che ci passavano
 * sotto — `ring-white`, le varianti con opacita' (`text-white/70`,
 * `bg-white/25`), una className su piu' righe col fondo altrove, `#fff`
 * scritto inline in un file autonomo, e un fondo dichiarato con una classe
 * che NON ESISTE (`bg-danger`), dove il bianco finiva sull'arancio sotto.
 *
 * Quindi qui non si cerca piu' l'accoppiata: si vieta il bianco scritto a
 * mano, punto, e le eccezioni si dichiarano. Un elenco di eccezioni si legge;
 * una regola che non vede niente, no.
 */
const ECCEZIONI = [
  /* Le uniche superfici bianche per davvero: fogli di stile dei report in
     stampa e il tema chiaro dei token, che il bianco lo DEFINISCE. */
  "app/globals.css",
  /* I campioni di colore scelti dall'utente prendono l'inchiostro misurato
     da lib/types.ts e lib/accenti-scale.ts, non una classe. */
];

const { execSync } = await import("node:child_process");

/*
 * I commenti di questo repo spiegano spesso PERCHE' una cosa non si fa, e
 * nominarla li' dentro non e' farla: la frase «il fondo era bg-danger, che non
 * esiste» farebbe fallire il controllo che vieta bg-danger.
 *
 * Non basta guardare se la riga COMINCIA con un marcatore: un commento lungo
 * ha righe di continuazione che cominciano con una parola qualunque. Quindi si
 * toglie il commento davvero, sostituendolo con spazi in modo che i numeri di
 * riga restino quelli veri. E' la stessa idea di `senzaCommenti` negli altri
 * script, con in piu' la conservazione delle righe.
 */
const senzaCommentiCache = new Map();
function righeSenzaCommenti(file) {
  if (senzaCommentiCache.has(file)) return senzaCommentiCache.get(file);
  const testo = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const pulito = testo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (m) =>
      m.replace(/\/\/.*$/, (c) => c.replace(/./g, " ")),
    );
  const righe = pulito.split("\n");
  senzaCommentiCache.set(file, righe);
  return righe;
}

/** `file:12:  <div className="bg-danger">` -> resta solo se quel pezzo di
 *  codice esiste ancora dopo aver tolto i commenti. */
function fuoriDaiCommenti(risultato) {
  const [file, numero] = risultato.split(":");
  const n = Number(numero);
  if (!file || !Number.isFinite(n)) return true;
  try {
    return (righeSenzaCommenti(file)[n - 1] ?? "").trim().length > 0;
  } catch {
    return true;
  }
}

function cerca(pattern) {
  try {
    return execSync(
      `git grep -n --untracked -E "${pattern}" -- components app lib`,
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((r) => !ECCEZIONI.some((e) => r.startsWith(e)))
      .filter((r) => fuoriDaiCommenti(r));
  } catch {
    /* git grep esce 1 quando non trova nulla: e' il caso buono. */
    return [];
  }
}

/* `--untracked` perche' un file appena creato non e' ancora nell'indice, e
   senza quel flag il controllo lo salterebbe in silenzio: il posto peggiore
   dove avere un buco e' proprio il codice nuovo. */
const bianchiAMano = [
  ...cerca("text-white"),
  ...cerca("ring-white"),
  ...cerca("(bg|text|border|ring)-white/"),
  ...cerca('(color|background|background-color): *.?#(fff|ffffff)'),
];
check(
  "Nessuno scrive il bianco a mano",
  bianchiAMano.length === 0,
  bianchiAMano.length === 0
    ? "si usano i token: text-primary-foreground, text-destructive-foreground, ring-card"
    : bianchiAMano.join(" | "),
);

/* E il fondo dev'essere un colore che esiste. `bg-danger` non esisteva — il
   tema dichiara `--danger-soft` e `--danger-text`, mai `--danger` — quindi
   quella pastiglia era trasparente e le cifre bianche stavano sull'arancio
   che aveva sotto. Una classe inventata non da' errore da nessuna parte: si
   limita a non fare niente. */
const DICHIARATI = new Set(
  [...CSS.matchAll(/--color-([\w-]+):/g)].map((m) => m[1]),
);
const FORME_TAILWIND = /^(\d+|\[.*\]|transparent|current|inherit|white|black|none|auto)$/;
const fondiInventati = cerca("(bg|text|border|ring)-[a-z]+(-[a-z0-9]+)*")
  .flatMap((riga) => {
    const [file, numero, ...resto] = riga.split(":");
    const codice = resto.join(":");
    return [...codice.matchAll(/\b(?:bg|text|border|ring)-([a-z][\w-]*)/g)]
      .map((m) => m[1])
      .filter((nome) => !FORME_TAILWIND.test(nome))
      .filter((nome) => {
        /* Si scarta il suffisso di opacita' e si prova anche il nome intero:
           `danger-soft` e' dichiarato, `danger` no. */
        const pulito = nome.split("/")[0];
        if (DICHIARATI.has(pulito)) return false;
        /* Le scale di Tailwind (slate-500, red-50...) non passano da @theme. */
        return /^(danger|success|warning|info|brand|ink|status|velo|canvas|scrim|selected)(-|$)/.test(
          pulito,
        );
      })
      /* `id="ring-brand"` e `url(#ring-brand)` non sono classi: sono nomi di
         gradienti SVG, e assomigliano a `ring-<colore>` solo per caso. */
      .filter(() => !/id=|url\(#/.test(codice))
      .map((nome) => `${file}:${numero} ${nome}`);
  });
check(
  "Ogni colore semantico usato e' davvero dichiarato",
  fondiInventati.length === 0,
  fondiInventati.length === 0
    ? "niente classi inventate: una classe che non esiste non sbaglia, semplicemente non fa niente"
    : [...new Set(fondiInventati)].join(" | "),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
