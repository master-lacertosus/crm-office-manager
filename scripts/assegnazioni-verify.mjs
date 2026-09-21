/**
 * Il lavoro assegnato non arriva in silenzio.
 *
 * Il difetto che questa funzionalita' toglie: una task poteva comparire
 * nella board di un collega senza dirgli niente. Chi assegnava lo dava per
 * detto, chi riceveva se ne accorgeva solo passando di li'.
 *
 * La prova guarda due cose diverse, e le tiene separate di proposito:
 *
 *   1. La logica di lettura (lib/assegnazioni.ts), esercitata davvero —
 *      importando il modulo vero, non ricopiandone le regole.
 *   2. Il fatto che l'avviso lo scriva SOLO il database. E' la scelta di
 *      fondo di M14: le strade che assegnano lavoro sono cinque e diventano
 *      sei al prossimo mese, e una regola ricopiata in sei punti diverge al
 *      primo che se ne dimentica. Se qualcuno domani fabbricasse un avviso
 *      di assegnazione dal browser, qui si accende un rosso.
 *
 *   node --import ./scripts/alias.mjs scripts/assegnazioni-verify.mjs
 */
import { readFileSync } from "node:fs";

import {
  daMostrare,
  destinazione,
  frase,
  nonViste,
} from "@/lib/assegnazioni.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/** Un avviso finto, ridotto a cio' che le funzioni guardano. */
const avviso = (id, kind, read_at = null, task_id = `t-${id}`) => ({
  id,
  to_user_id: "io",
  from_user_id: "capo",
  message: "Ti ha assegnato «qualcosa»",
  task_id,
  kind,
  created_at: "2026-09-18T09:00:00.000Z",
  read_at,
});

/* ------------------------------------------------------------------ */
console.log("\n# Quali avvisi contano come lavoro arrivato\n");
/* ------------------------------------------------------------------ */

const misti = [
  avviso("a1", "assegnazione"),
  avviso("m1", "mention"),
  avviso("s1", "sollecito"),
  avviso("sys", "sistema"),
  avviso("a2", "assegnazione"),
  avviso("a3", "assegnazione", "2026-09-18T10:00:00.000Z"),
];

check(
  "Solo le assegnazioni, e solo quelle non lette",
  nonViste(misti)
    .map((n) => n.id)
    .join(",") === "a1,a2",
  "menzioni, solleciti e promemoria di sistema non sono lavoro che arriva",
);

check(
  "Un promemoria di sistema non gonfia il conteggio",
  nonViste([avviso("sys", "sistema")]).length === 0,
  "il risveglio di uno snooze non e' una task nuova",
);

/* ------------------------------------------------------------------ */
console.log("\n# Mettere via non e' aver letto\n");
/* ------------------------------------------------------------------ */

const tre = [
  avviso("a1", "assegnazione"),
  avviso("a2", "assegnazione"),
  avviso("a3", "assegnazione"),
];

check(
  "Senza niente messo via si mostra tutto",
  daMostrare(tre, new Set()).length === 3,
);

check(
  "Messe via tutte, il banner tace",
  daMostrare(tre, new Set(["a1", "a2", "a3"])).length === 0,
);

/* Il caso per cui questa funzione tiene gli id e non un numero. Con il
   conteggio: messe via 3, ne arrivano 2, e 2 <= 3 tiene nascosto il lavoro
   nuovo — in silenzio, che e' il difetto che stiamo togliendo. */
const dueNuove = [avviso("b1", "assegnazione"), avviso("b2", "assegnazione")];
check(
  "Ne metto via tre, ne arrivano due: il banner torna",
  daMostrare(dueNuove, new Set(["a1", "a2", "a3"])).length === 2,
  "e' il motivo per cui si ricordano gli id, non quante erano",
);

check(
  "Chi e' rimasto fuori resta visibile",
  daMostrare(tre, new Set(["a1"]))
    .map((n) => n.id)
    .join(",") === "a2,a3",
);

/* ------------------------------------------------------------------ */
console.log("\n# Cosa si legge e dove si finisce\n");
/* ------------------------------------------------------------------ */

check("Una sola si dice al singolare", frase(1) === "Hai 1 nuova task assegnata");
check("Da due in su, al plurale", frase(3) === "Hai 3 nuove task assegnate");

check(
  "Una sola: si apre quella",
  destinazione([avviso("a1", "assegnazione", null, "task-42")], "io") ===
    "/tasks?task=task-42",
  "e' la risposta completa, non serve un elenco di uno",
);

check(
  "Piu' d'una: l'elenco dei propri lavori",
  destinazione(tre, "io") === "/tasks?owner=io&view=list",
  "aprirne una a caso sceglierebbe al posto di chi legge",
);

check(
  "Un avviso senza task non manda su una pagina rotta",
  destinazione([avviso("a1", "assegnazione", null, null)], "io") ===
    "/tasks?owner=io&view=list",
);

/* ------------------------------------------------------------------ */
console.log("\n# L'avviso lo scrive il database, e nessun altro\n");
/* ------------------------------------------------------------------ */

const sql = readFileSync(
  "supabase/migrations/20260918120000_m14_assegnazioni.sql",
  "utf8",
);

check(
  "La natura «assegnazione» e' ammessa dal vincolo",
  /check \(kind in \([^)]*'assegnazione'[^)]*\)\)/.test(sql),
  "senza questo ogni inserimento verrebbe respinto dal CHECK",
);

check(
  "Il trigger scatta alla nascita della task",
  /create trigger tasks_avvisa_assegnazione_ins\s+after insert on public\.tasks/.test(
    sql,
  ),
);

check(
  "E anche quando il responsabile cambia",
  /create trigger tasks_avvisa_assegnazione_upd\s+after update of owner_id on public\.tasks/.test(
    sql,
  ),
  "una task che ti passano e' lavoro che arriva come una appena scritta",
);

check(
  "Il cambio di responsabile e' confrontato, non dato per buono",
  /when \(new\.owner_id is distinct from old\.owner_id\)/.test(sql),
  "senza il confronto, ogni salvataggio che contiene owner_id manderebbe un avviso",
);

check(
  "Nessuno si avvisa da solo",
  /if new\.owner_id = coalesce\(mittente, new\.created_by\) then\s+return new;/.test(
    sql,
  ),
  "le task che ci si scrive per se' non producono niente",
);

check(
  "La funzione non eredita il search_path",
  /security definer\s+set search_path = ''/.test(sql),
  "dentro una security definer e' il modo classico di farsi eseguire codice altrui",
);

/* La regola vera: il browser non deve poter fabbricare un avviso di
   assegnazione. Non e' un dettaglio di stile — due sorgenti per lo stesso
   fatto vogliono dire doppioni sulla campanella di qualcun altro. */
const queries = readFileSync("lib/supabase/queries.ts", "utf8");
const firma = /kind\?: ("mention" \| "sollecito" \| "sistema")/.exec(queries);
check(
  "insertNotifications non accetta le assegnazioni",
  firma !== null,
  firma ? "il compilatore rifiuta chi ci prova" : "la firma e' cambiata",
);

const store = readFileSync("lib/store.tsx", "utf8");
check(
  "Lo store non rimanda al database gli avvisi che ha appena letto",
  /n\.kind !== "assegnazione"/.test(store),
  "rimandarli indietro creerebbe un doppione dell'avviso appena arrivato",
);

/* Tre viste dello stesso fatto: banner, campanella, contatore della voce
   Task. Se una si ricalcolasse il numero per conto suo sarebbe libera di
   dirne uno diverso, e il primo che sbaglia distrugge la fiducia negli
   altri due. */
for (const [file, chi] of [
  ["components/nuove-assegnazioni.tsx", "Il banner"],
  ["components/shell/sidebar.tsx", "Il contatore della sidebar"],
]) {
  const src = readFileSync(file, "utf8");
  check(
    `${chi} legge il conteggio dello store, non se lo rifa'`,
    src.includes("nuoveAssegnazioni") &&
      !/kind === "assegnazione"/.test(src),
    "un solo elenco, tre viste",
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
