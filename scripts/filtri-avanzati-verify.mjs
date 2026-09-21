/**
 * Un filtro solo, per tutte le viste.
 *
 * La regola "questo task rientra" viveva in quattro copie -- board, elenco,
 * calendario, agenda -- e tutte e quattro conoscevano solo responsabile e
 * progetto. E' la stessa storia dell'ordinamento (scripts/ordine-verify):
 * copie libere di divergere, e nessuno se ne accorge finche' due viste degli
 * stessi task non raccontano cose diverse.
 *
 * Qui si esercita il modulo vero, e si vigila che le quattro viste continuino
 * a passare da li' invece di rifarsi il filtro in casa.
 *
 *   node --import ./scripts/alias.mjs scripts/filtri-avanzati-verify.mjs
 */
import { readFileSync } from "node:fs";

import {
  applicaFiltri,
  CHIAVI_FILTRO,
  leggiFiltri,
  quantiFiltriAvanzati,
} from "@/lib/filtri.ts";
import { todayIso, addDaysIso } from "@/lib/format.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const CAPO = { id: "capo", role: "admin" };
const DIP = { id: "dip", role: "member" };

let n = 0;
const task = (p = {}) => ({
  id: `t${++n}`,
  title: "Senza titolo",
  description: null,
  priority: "normal",
  owner_id: "dip",
  created_by: "capo",
  project_id: null,
  status: "todo",
  due_date: null,
  position: n,
  repeat: "none",
  completed_at: null,
  created_at: "2026-09-18T08:00:00.000Z",
  archived_at: null,
  ...p,
});

const filtri = (qs, utente = CAPO) =>
  leggiFiltri(new URLSearchParams(qs), utente);

/* ------------------------------------------------------------------ */
console.log("\n# Il predefinito segue ancora il ruolo\n");
/* ------------------------------------------------------------------ */

const miei = task({ owner_id: "dip" });
const altrui = task({ owner_id: "altro" });

check(
  "Un dipendente senza filtri vede i propri",
  applicaFiltri([miei, altrui], filtri("", DIP)).length === 1,
);
check(
  "Un responsabile senza filtri vede tutti",
  applicaFiltri([miei, altrui], filtri("", CAPO)).length === 2,
);
check(
  "«Tutti» resta un gesto esplicito che funziona",
  applicaFiltri([miei, altrui], filtri("owner=all", DIP)).length === 2,
);

/* ------------------------------------------------------------------ */
console.log("\n# I criteri nuovi\n");
/* ------------------------------------------------------------------ */

const urgente = task({ priority: "high" });
const calmo = task({ priority: "low" });
check(
  "Priorità",
  applicaFiltri([urgente, calmo], filtri("priority=high")).length === 1,
);

const inCorso = task({ status: "in_progress" });
const daFare = task({ status: "todo" });
check(
  "Fase",
  applicaFiltri([inCorso, daFare], filtri("stato=in_progress"))[0]?.status ===
    "in_progress",
);

const scaduto = task({ due_date: addDaysIso(-3) });
const oggi = task({ due_date: todayIso() });
const fraCinque = task({ due_date: addDaysIso(5) });
const lontano = task({ due_date: addDaysIso(40) });
const senzaData = task({ due_date: null });
const tutte = [scaduto, oggi, fraCinque, lontano, senzaData];

check(
  "Scadenza: in ritardo",
  applicaFiltri(tutte, filtri("scadenza=ritardo")).length === 1,
);
check(
  "Scadenza: oggi",
  applicaFiltri(tutte, filtri("scadenza=oggi")).length === 1,
);
check(
  "Scadenza: entro 7 giorni, arretrato compreso",
  applicaFiltri(tutte, filtri("scadenza=settimana")).length === 3,
  "scaduto + oggi + fra cinque: chi guarda la settimana non deve scoprire dopo cosa si trascina dietro",
);
check(
  "Scadenza: senza data e' un criterio, non l'assenza di criterio",
  applicaFiltri(tutte, filtri("scadenza=senza")).length === 1,
);

const packaging = task({ title: "Rifare il PACKAGING" });
const testi = task({ title: "Testi", description: "Rivedere il packaging" });
const altro2 = task({ title: "Spedizioni" });
check(
  "Ricerca: nel titolo, senza badare alle maiuscole",
  applicaFiltri([packaging, altro2], filtri("q=packaging")).length === 1,
);
check(
  "Ricerca: anche nella descrizione",
  applicaFiltri([testi, altro2], filtri("q=packaging")).length === 1,
);

/* ------------------------------------------------------------------ */
console.log("\n# Quello che non deve succedere\n");
/* ------------------------------------------------------------------ */

check(
  "Un valore inventato nell'indirizzo non svuota la board",
  applicaFiltri([urgente, calmo], filtri("priority=banana")).length === 2,
  "?priority=banana si ignora, non nasconde tutto",
);
check(
  "Una finestra di scadenza inventata si ignora",
  applicaFiltri(tutte, filtri("scadenza=domani")).length === 5,
);
check(
  "L'archivio resta fuori comunque",
  applicaFiltri([task({ archived_at: "2026-09-01T00:00:00Z" })], filtri(""))
    .length === 0,
);
check(
  "I criteri si sommano, non si sostituiscono",
  applicaFiltri(
    [
      task({ owner_id: "dip", priority: "high", status: "in_progress" }),
      task({ owner_id: "dip", priority: "high", status: "todo" }),
      task({ owner_id: "altro", priority: "high", status: "in_progress" }),
    ],
    filtri("owner=dip&priority=high&stato=in_progress"),
  ).length === 1,
);

/* ------------------------------------------------------------------ */
console.log("\n# Il numero sul pulsante «Filtri»\n");
/* ------------------------------------------------------------------ */

check(
  "Responsabile e progetto non si contano (hanno il loro menu in vista)",
  quantiFiltriAvanzati(filtri("owner=dip&project=p1")) === 0,
);
check(
  "I quattro nascosti si contano tutti",
  quantiFiltriAvanzati(filtri("priority=high&stato=todo&scadenza=oggi&q=x")) ===
    4,
  "un filtro che nasconde meta' board senza mostrarsi fa credere che i dati siano spariti",
);

/* ------------------------------------------------------------------ */
console.log("\n# Una regola sola, quattro viste\n");
/* ------------------------------------------------------------------ */

for (const [file, nome] of [
  ["components/board/board.tsx", "Board"],
  ["components/task-list.tsx", "Elenco"],
  ["components/calendar-view.tsx", "Calendario"],
  ["components/agenda-view.tsx", "Agenda"],
]) {
  const src = readFileSync(file, "utf8");
  check(
    `${nome} passa dal modulo dei filtri`,
    src.includes("applicaFiltri") && src.includes("leggiFiltri"),
  );
  check(
    `  ${nome} non si rifa' il filtro in casa`,
    !/t\.owner_id === owner|task\.owner_id !== ownerFilter/.test(src),
    "quattro copie sono quattro occasioni di divergere",
  );
}

/* Le viste salvate devono seguire i criteri nuovi senza che nessuno si
   ricordi di aggiornarle: se domani si aggiunge un criterio, `CHIAVI_FILTRO`
   lo porta con se'. */
const viste = readFileSync("components/saved-views.tsx", "utf8");
check(
  "Le viste salvate leggono l'elenco dei criteri, non una copia",
  viste.includes("CHIAVI_FILTRO") &&
    !/for \(const key of \["owner", "project", "view"\]\)/.test(viste),
  `oggi i criteri sono ${CHIAVI_FILTRO.length}`,
);

const memoria = readFileSync("lib/memoria-filtri.ts", "utf8");
check(
  "La memoria dei filtri non perde i criteri nuovi cambiando pagina",
  CHIAVI_FILTRO.every((k) => memoria.includes(`"${k}"`)),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
