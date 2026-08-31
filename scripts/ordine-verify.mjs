/**
 * Board ed Elenco raccontano lo stesso ordine.
 *
 * Il difetto segnalato: «un lavoro con scadenza oggi, appena aggiunto, in
 * board lo vedo in fondo, in elenco in alto». Vero, e la causa era che la
 * regola delle scadenze esisteva in un punto solo — la vista Elenco —
 * mentre board, frecce del pannello, calendario, dashboard, standup e
 * carichi ordinavano per `position`, cioe' per il momento in cui il task
 * era stato creato (`position: Date.now()`). Il nuovo finiva in fondo.
 *
 * Peggio: la stessa regola era stata riscritta a mano in cinque punti. Non
 * si erano divise per caso — si erano divise perche' erano copie.
 *
 *   node scripts/ordine-verify.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  confrontaPerScadenza,
  loSpostamentoReggera,
  ordinaPerScadenza,
} from "../lib/ordine.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const t = (titolo, due_date, position) => ({ titolo, due_date, position });

console.log("\n# Il caso segnalato\n");

{
  /* La board di Francesco: tre lavori vecchi senza fretta, e un urgente
     appena scritto — che avendo `position: Date.now()` era l'ultimo. */
  const colonna = [
    t("Vecchio senza scadenza", null, 1000),
    t("Fra due settimane", "2026-09-14", 1001),
    t("Fra una settimana", "2026-09-07", 1002),
    t("URGENTE appena aggiunto", "2026-08-31", 1700000000000),
  ];
  const ordinata = ordinaPerScadenza(colonna).map((x) => x.titolo);

  check(
    "L'urgente appena aggiunto sta in cima, non in fondo",
    ordinata[0] === "URGENTE appena aggiunto",
    ordinata[0],
  );
  check(
    "…e il resto segue la scadenza",
    ordinata.join(" | ") ===
      "URGENTE appena aggiunto | Fra una settimana | Fra due settimane | Vecchio senza scadenza",
    ordinata.join(" | "),
  );
}

console.log("\n# Chi non ha una data\n");

check(
  "Un lavoro senza scadenza sta dopo uno che ce l'ha",
  confrontaPerScadenza(t("a", null, 1), t("b", "2030-01-01", 9)) > 0,
);
check(
  "Fra due senza scadenza decide l'ordine manuale",
  confrontaPerScadenza(t("a", null, 5), t("b", null, 9)) < 0,
);
check(
  "…e non si perde: restano nell'ordine in cui erano",
  ordinaPerScadenza([t("terzo", null, 3), t("primo", null, 1)])
    .map((x) => x.titolo)
    .join(",") === "primo,terzo",
);

console.log("\n# L'ordinamento non rovina l'elenco di partenza\n");

{
  const originale = [t("b", "2026-09-02", 2), t("a", "2026-09-01", 1)];
  const r = ordinaPerScadenza(originale);
  check("L'elenco di partenza resta com'era", originale[0].titolo === "b");
  check("…e il risultato e' un elenco nuovo", r !== originale);
}

console.log("\n# Il trascinamento dice la verita'\n");

check(
  "Spostare in un'altra colonna funziona sempre",
  loSpostamentoReggera(t("a", "2026-09-01", 1), "todo", "in_progress"),
);
check(
  "Riordinare a mano un lavoro senza scadenza attacca",
  loSpostamentoReggera(t("a", null, 1), "todo", "todo"),
);
check(
  "Riordinare fra lavori dello STESSO giorno attacca",
  loSpostamentoReggera(t("a", "2026-09-01", 5), "todo", "todo", {
    prima: t("b", "2026-09-01", 1),
    dopo: t("c", "2026-09-01", 9),
  }),
);
check(
  "Scavalcare una scadenza piu' vicina non attacca — e va detto",
  !loSpostamentoReggera(t("a", "2026-09-10", 5), "todo", "todo", {
    prima: t("b", "2026-09-01", 1),
    dopo: t("c", "2026-09-02", 9),
  }),
);
check(
  "Infilarsi prima di chi scade prima non attacca",
  !loSpostamentoReggera(t("a", "2026-09-10", 5), "todo", "todo", {
    dopo: t("c", "2026-09-02", 9),
  }),
);

console.log("\n# A parita' di scadenza decide l'ordine manuale\n");

check(
  "Stesso giorno: viene prima chi sta piu' in alto",
  confrontaPerScadenza(t("a", "2026-09-01", 9), t("b", "2026-09-01", 1)) > 0,
);
check(
  "…e l'ordine non cambia da solo fra una ricarica e l'altra",
  ordinaPerScadenza([
    t("terzo", "2026-09-01", 3),
    t("primo", "2026-09-01", 1),
    t("secondo", "2026-09-01", 2),
  ])
    .map((x) => x.titolo)
    .join(",") === "primo,secondo,terzo",
);

console.log("\n# Una regola sola, non sei copie\n");

{
  const tsx = (dir, dentro = []) => {
    for (const v of readdirSync(dir)) {
      if (v === "node_modules" || v === ".next") continue;
      const p = join(dir, v);
      if (statSync(p).isDirectory()) tsx(p, dentro);
      else if (v.endsWith(".tsx")) dentro.push(p);
    }
    return dentro;
  };

  const copie = tsx("components").filter((f) =>
    /!a\.due_date && !b\.due_date/.test(readFileSync(f, "utf8")),
  );
  check(
    "Nessuna vista riscrive la regola per conto suo",
    copie.length === 0,
    copie.length === 0 ? "tutte passano da lib/ordine" : copie.join(", "),
  );

  /* I sotto-task restano in ordine manuale di proposito: sono i passi di
     un lavoro, nell'ordine in cui chi lo guida li ha pensati. */
  const perPosizione = tsx("components").filter(
    (f) =>
      /a\.position - b\.position/.test(readFileSync(f, "utf8")) &&
      !f.includes("sotto-task"),
  );
  check(
    "Nessuna vista ordina ancora per momento di creazione",
    perPosizione.length === 0,
    perPosizione.length === 0
      ? "solo i sotto-task, che e' voluto"
      : perPosizione.join(", "),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
