/**
 * Un pannello a schermo intero deve appendersi al `body`.
 *
 * Il difetto segnalato: aprendo la modalita' standup, il pannello usciva
 * ritagliato — «non apre il popup completo».
 *
 * La causa non era nel pannello ma in chi lo ospita. Il pulsante dello
 * standup vive nella Topbar, che porta un `backdrop-filter` per l'effetto
 * vetro; e un antenato con `backdrop-filter` (come uno con `transform` o
 * `filter`) diventa il riferimento di tutto cio' che sta sotto di lui in
 * `position: fixed`. Cosi' `fixed inset-0` non copriva la finestra:
 * copriva la barra alta 64px, e li' dentro veniva tagliato.
 *
 * Non e' un dettaglio di un componente: e' una regola dell'impaginazione
 * che vale per chiunque apra una sovrapposizione da dentro il telaio
 * dell'app. Gli altri cinque pannelli passano gia' da un portale; lo
 * standup era l'unico rimasto indietro, e nessuno se ne era accorto
 * perche' il difetto si vede solo aprendolo.
 *
 *   node scripts/sovrapposizioni-verify.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const tsx = (dir, dentro = []) => {
  for (const v of readdirSync(dir)) {
    if (v === "node_modules" || v === ".next") continue;
    const p = join(dir, v);
    if (statSync(p).isDirectory()) tsx(p, dentro);
    else if (v.endsWith(".tsx")) dentro.push(p);
  }
  return dentro;
};

console.log("\n# Chi si apre dalla Topbar passa da un portale\n");

/* La regola vale dove c'e' il pericolo, non ovunque: un pannello montato
   nella radice dell'app sta gia' bene dov'e', e pretendere il portale da
   tutti farebbe fallire codice sano — un controllo che grida al lupo
   smette di essere letto.
   Il pericolo e' preciso: i pulsanti passati a `<Topbar actions={...}>`
   vivono dentro il vetro, e tutto cio' che aprono nasce li' dentro. */
const pagine = tsx("app");
const azioniTopbar = new Set();
for (const f of pagine) {
  const s = readFileSync(f, "utf8");
  const m = /actions=\{([\s\S]*?)\n\s*\}/.exec(s);
  if (!m) continue;
  for (const [, nome] of m[1].matchAll(/<([A-Z][A-Za-z]*)/g)) {
    if (nome !== "Suspense") azioniTopbar.add(nome);
  }
}

const perFile = (nome) =>
  "components/" +
  nome.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() +
  ".tsx";

check(
  "Ci sono pulsanti nella Topbar da controllare",
  azioniTopbar.size > 0,
  [...azioniTopbar].join(", "),
);

const colpevoli = [];
for (const nome of azioniTopbar) {
  const file = perFile(nome);
  let s;
  try {
    s = readFileSync(file, "utf8");
  } catch {
    continue; /* nome che non corrisponde a un file: non e' un pannello */
  }

  /* Il pulsante puo' aprire il pannello dentro di se' oppure caricarlo a
     parte: si seguono le importazioni dinamiche di un livello. */
  const da = [[file, s]];
  for (const [, mod] of s.matchAll(/import\("@\/components\/([a-z0-9-]+)"/g)) {
    try {
      da.push([`components/${mod}.tsx`, readFileSync(`components/${mod}.tsx`, "utf8")]);
    } catch {
      /* modulo non trovato: lo si ignora */
    }
  }

  for (const [f, testo] of da) {
    const copreLoSchermo = /className="[^"]*\bfixed inset-0\b/.test(testo);
    if (copreLoSchermo && !testo.includes("createPortal")) {
      colpevoli.push(`${nome} -> ${f}`);
    }
  }
}

check(
  "Nessun pannello aperto dalla Topbar nasce dentro il vetro",
  colpevoli.length === 0,
  colpevoli.length === 0
    ? "tutti appesi al body"
    : colpevoli.join(", "),
);

console.log("\n# Il telaio che ha causato il guasto\n");

/* Se un giorno la Topbar perdesse il vetro, il difetto sparirebbe da
   solo e questa prova non servirebbe piu'. Finche' c'e', vale la pena
   ricordare perche' il portale non e' facoltativo. */
const topbar = readFileSync("components/shell/topbar.tsx", "utf8");
check(
  "La Topbar usa ancora il vetro (ed e' per questo che serve il portale)",
  /glass-chrome|backdrop-blur/.test(topbar),
  "un antenato con backdrop-filter ancora i `fixed` a se stesso",
);

const standup = readFileSync("components/standup-mode.tsx", "utf8");
check(
  "Lo standup si appende al body",
  standup.includes("createPortal(pannello, document.body)"),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
