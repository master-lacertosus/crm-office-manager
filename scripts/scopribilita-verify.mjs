/**
 * Quello che c'e' deve potersi trovare.
 *
 * Sette richieste arrivate dall'ufficio; cinque descrivevano funzioni che
 * ESISTEVANO GIA' nel codice. Non mancavano: non si vedevano. E' la terza
 * volta che succede su questo repo (prima le viste salvate, prima ancora la
 * stellina della vista di partenza), quindi qui si mettono per iscritto le
 * condizioni che le rendono trovabili — perche' una funzione invisibile, per
 * chi la usa, non esiste, e si rende invisibile di nuovo al primo ritocco
 * distratto.
 *
 * Le regole sono tre, e tornano sempre le stesse:
 *   1. Uno stato non si tiene in un `useState` che si azzera a ogni visita.
 *   2. Un comando non si nasconde dietro `opacity-0` ne' dentro un `title`.
 *   3. Una cosa sola ha un nome solo.
 *
 *   node --import ./scripts/alias.mjs scripts/scopribilita-verify.mjs
 */
import { readFileSync } from "node:fs";

import { CHIAVI_FILTRO } from "@/lib/filtri.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");

/* ------------------------------------------------------------------ */
console.log("\n# 1. La ricerca globale ha una porta visibile\n");
/* ------------------------------------------------------------------ */

const palette = leggi("components/command-palette.tsx");
const topbar = leggi("components/shell/topbar.tsx");
const cerca = leggi("components/shell/cerca-tutto.tsx");

check(
  "La palette si puo' aprire senza conoscere Ctrl+K",
  /export function apriRicerca/.test(palette) &&
    /addEventListener\(EVENTO_APRI/.test(palette),
  "cercava gia' in task, progetti, persone, richieste, ferie e commenti: mancava la porta",
);
check(
  "Il campo «Cerca» sta nella barra di OGNI pagina",
  topbar.includes("<CercaTutto />"),
);
check(
  "E dice anche la scorciatoia, cosi' la volta dopo si usa quella",
  /⌘K/.test(cerca) && /Ctrl K/.test(cerca),
);
check(
  "Una sola sorgente per il nome dell'evento",
  (palette.match(/"ricerca:apri"/g) ?? []).length === 1 &&
    !cerca.includes("ricerca:apri"),
  "chi apre importa la funzione, non ricopia la stringa",
);

/* ------------------------------------------------------------------ */
console.log("\n# 2. Le scorciatoie si vedono dove si clicca\n");
/* ------------------------------------------------------------------ */

const scorciatoie = leggi("components/shell/scorciatoie.tsx");
const sidebar = leggi("components/shell/sidebar.tsx");

check(
  "T e N portano entrambi ai Task",
  /t: \{ dove: "\/tasks"/.test(scorciatoie) &&
    /n: \{ dove: "\/tasks"/.test(scorciatoie),
);
check(
  "P porta ai Progetti",
  /p: \{ dove: "\/projects"/.test(scorciatoie),
);
check(
  "La creazione rapida non si e' persa: e' su C",
  /if \(tasto === "c"\)[\s\S]{0,140}updateSearch\(\{ task: "new" \}\)/.test(
    scorciatoie,
  ),
  "N creava un task; ora porta ai Task, e creare e' passato alla lettera giusta",
);
check(
  "La barra laterale mostra le lettere",
  sidebar.includes("tastoPer(item.href)") && /<kbd/.test(sidebar),
  "l'unico posto che le elencava era Impostazioni > Info",
);
check(
  "L'elenco delle lettere sta in un posto solo",
  /export const TASTI/.test(scorciatoie) &&
    !/"\/projects"/.test(sidebar.replace(/href: "\/projects"/g, "")),
  "la sidebar chiede allo stesso modulo che le esegue",
);

/* ------------------------------------------------------------------ */
console.log("\n# 3. L'attivita' nel calendario si vede davvero\n");
/* ------------------------------------------------------------------ */

const calendario = leggi("components/calendar-view.tsx");

check(
  "Non si spegne a ogni visita: la scelta vive nell'indirizzo",
  /searchParams\.get\("attivita"\) !== "0"/.test(calendario) &&
    !/useState\(false\)[\s\S]{0,40}mostraAttivita/.test(calendario),
  "era un useState spento di partenza: il gesto andava rifatto ogni volta",
);
check(
  "E' accesa di partenza",
  /!== "0"/.test(calendario),
  "il parametro serve per SPEGNERLA, non per accenderla",
);
check(
  "Gli eventi seguono gli stessi filtri dei task",
  /const visibili = new Set\(tasks\.map\(\(t\) => t\.id\)\)/.test(calendario) &&
    /if \(!visibili\.has\(ev\.task_id\)\) continue;/.test(calendario),
  "prima la cella contava lavori che la stessa griglia stava nascondendo",
);
check(
  "Conta piu' del solo cambio di fase",
  /TIPI_ATTIVITA = new Set[\s\S]{0,160}"due_changed"[\s\S]{0,40}"owner_changed"/.test(
    calendario,
  ),
  "una giornata passata a riassegnare e spostare consegne risultava vuota",
);
check(
  "Il dettaglio non vive dentro un `title`",
  !/title=\{svolte/.test(calendario),
  "su un telefono un tooltip non esiste: si leggeva «3 movimenti» e finiva li'",
);
check(
  "Il giorno e' quello locale, non quello di Greenwich",
  /giornoLocale\(ev\.created_at\)/.test(calendario),
  "un lavoro chiuso a Roma dopo le 22 finiva nella casella del giorno prima",
);

/* ------------------------------------------------------------------ */
console.log("\n# 4. I filtri sopravvivono a come esci dalla pagina\n");
/* ------------------------------------------------------------------ */

const memoria = leggi("lib/memoria-filtri.ts");
const guardiano = leggi("components/shell/memoria-di-dove-eri.tsx");
const layout = leggi("app/(app)/layout.tsx");

check(
  "La memoria sopravvive a un ricaricamento",
  /sessionStorage/.test(memoria),
  "era una Map di modulo: bastava un F5 e i filtri sparivano",
);
check(
  "...ma muore chiudendo la scheda, come promesso",
  /window\.sessionStorage/.test(memoria) &&
    !/window\.localStorage/.test(memoria),
  "due finestre su due progetti restano due cose separate",
);
check(
  "Una sessione negata non rompe niente",
  /catch \{/.test(memoria),
  "finestra anonima o impostazioni restrittive: si torna al comportamento di prima",
);
check(
  "Si annota a OGNI cambio pagina, non solo dalla barra laterale",
  /prima\.percorso !== pathname/.test(guardiano) && /ricorda\(/.test(guardiano),
  "palette, scorciatoie, tasto indietro e link profondi uscivano in silenzio",
);
check(
  "Il guardiano e' montato e sospeso",
  /<MemoriaDiDoveEri \/>/.test(layout) &&
    /<Suspense>\s*<MemoriaDiDoveEri/.test(layout),
  "legge useSearchParams: senza Suspense toglie la generazione statica a ogni pagina",
);
check(
  "Ricorda tutti i criteri, non solo i due vecchi",
  CHIAVI_FILTRO.every((k) => memoria.includes(`"${k}"`)),
  `oggi i criteri sono ${CHIAVI_FILTRO.length}`,
);

/* ------------------------------------------------------------------ */
console.log("\n# 5. Una cosa sola ha un nome solo\n");
/* ------------------------------------------------------------------ */

const inCreazione = leggi("components/pezzi-in-creazione.tsx");
const sottoTask = leggi("components/sotto-task.tsx");

check(
  "Nella creazione si chiamano sotto-task",
  />\s*Sotto-task/.test(inCreazione) && !/Pezzi di questo lavoro/.test(inCreazione),
  "si chiamavano «Pezzi»: non si cerca una cosa di cui non si conosce il nome",
);
check(
  "Sul task esistente si chiamano sotto-task",
  /\n\s*Sotto-task\n/.test(sottoTask) && !/^\s*Lavori$/m.test(sottoTask),
  "si chiamavano «Lavori»: terzo nome per lo stesso oggetto",
);
check(
  "Anche per chi usa un lettore di schermo",
  /aria-label="Sotto-task"/.test(sottoTask),
);
check(
  "E si dice subito che si possono gia' assegnare",
  /puoi gi(a|à) assegnarli/.test(inCreazione),
  "era la meta' della richiesta, e non la diceva nessuno",
);

/* ------------------------------------------------------------------ */
console.log("\n# 6. L'interruttore degli avvisi sta dove lo si cerca\n");
/* ------------------------------------------------------------------ */

const aspetto = leggi("components/appearance-settings.tsx");

check(
  "Ha una scheda sua, intitolata «Avvisi»",
  /title="Avvisi"/.test(aspetto),
  "era la terza voce dentro «Movimento», che parla di animazioni e contrasto",
);
check(
  "E dice dove compaiono, cosi' si riconoscono",
  /in basso a destra/.test(aspetto),
);

/* ------------------------------------------------------------------ */
console.log("\n# 7. Il pannello laterale e' piu' largo, e nessuno ci perde\n");
/* ------------------------------------------------------------------ */

const pannello = leggi("components/task-panel.tsx");
const PRIMA = { sm: 460, lg: 560, xl: 680, "2xl": 680 };
const trovate = {};
for (const [chiave, regex] of [
  ["sm", /sm:w-\[(\d+)px\]/],
  ["lg", /lg:w-\[(\d+)px\]/],
  ["xl", /xl:w-\[(\d+)px\]/],
  ["2xl", /2xl:w-\[(\d+)px\]/],
]) {
  const m = regex.exec(pannello);
  trovate[chiave] = m ? Number(m[1]) : null;
}
for (const chiave of ["sm", "lg", "xl", "2xl"]) {
  check(
    `  ${chiave}: ${PRIMA[chiave]}px → ${trovate[chiave] ?? "assente"}px`,
    trovate[chiave] !== null && trovate[chiave] > PRIMA[chiave],
    "nessuna larghezza deve peggiorare",
  );
}
check(
  "Sopra i 1280px la scala non si ferma piu'",
  trovate["2xl"] !== null,
  "un monitor da 1920 dava gli stessi 680px di un portatile",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
