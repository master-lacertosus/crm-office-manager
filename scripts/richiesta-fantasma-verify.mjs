/**
 * Non si annuncia un lavoro che non e' stato salvato.
 *
 * Il difetto, visto in produzione il 21 settembre 2026: Riccardo invia una
 * richiesta di task, legge "Richiesta inviata", e tre responsabili ricevono
 * l'avviso. Sul database quella richiesta NON ESISTE. Nessuno se n'e'
 * accorto per ore, perche' ogni singolo pezzo si comportava come previsto.
 *
 * La catena, tutta dimostrabile:
 *
 *   1. `createRequest` era `async` ma non aspettava NESSUNA scrittura:
 *      aggiornava lo stato locale e tornava.
 *   2. La richiesta e gli avvisi finivano in DUE sincronizzatori
 *      indipendenti, su una coda che per progetto non muore su un errore.
 *      Il fallimento del primo non fermava il secondo.
 *   3. Il sincronizzatore segna la riga come scritta PRIMA di scriverla,
 *      quindi la richiesta persa non veniva nemmeno ritentata.
 *   4. Il modulo mostrava il messaggio di conferma comunque, e si svuotava:
 *      quello che era stato scritto era perso due volte.
 *   5. L'avviso nasceva senza destinazione, e la campanella lo rendeva come
 *      un pulsante che a premerlo non faceva niente.
 *
 * Cinque cose in fila, e ognuna era "solo" un dettaglio. Questa prova
 * vigila su tutte e cinque.
 *
 *   node --import ./scripts/alias.mjs scripts/richiesta-fantasma-verify.mjs
 */
import { readFileSync } from "node:fs";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");
const senzaCommenti = (p) =>
  leggi(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

const store = leggi("lib/store.tsx");
const richieste = leggi("components/requests-content.tsx");
const ferie = leggi("components/leave-content.tsx");
const campanella = leggi("components/notifications.tsx");
const queries = leggi("lib/supabase/queries.ts");
const m17 = leggi("supabase/migrations/20260921160000_m17_avvisi_con_destinazione.sql");

/* ------------------------------------------------------------------ */
console.log("\n# 1. Si aspetta l'esito prima di annunciare\n");
/* ------------------------------------------------------------------ */

check(
  "createRequest scrive davvero, e aspetta",
  /await insertTaskRequest\(createClient\(\), request\)/.test(store),
  "era async senza un solo await: metteva tutto in locale e tornava",
);
check(
  "createLeave idem",
  /await insertLeaveRequest\(createClient\(\), leave\)/.test(store),
  "stesso difetto, stessa cura: una ferie poteva sparire allo stesso modo",
);
check(
  "Se il database rifiuta, non si avvisa nessuno",
  /catch \(e\) \{[\s\S]{0,260}Richiesta non inviata[\s\S]{0,120}return null;/.test(store),
);
check(
  "E la firma lo dice a chi chiama",
  /createRequest[\s\S]{0,400}Promise<TaskRequest \| null>/.test(store) &&
    /createLeave[\s\S]{0,300}Promise<LeaveRequest \| null>/.test(store),
);

/* ------------------------------------------------------------------ */
console.log("\n# 2. La riga non viene scritta due volte\n");
/* ------------------------------------------------------------------ */

check(
  "Il sincronizzatore salta cio' che e' gia' stato scritto",
  /saltaSeGiaScritta/.test(store) && /giaScritte/.test(store),
  "senza, l'inserimento esplicito e quello del sincronizzatore collidono sulla chiave primaria",
);
check(
  "E se la scrittura fallisce, la riga torna disponibile",
  /giaScritte\.current\.delete\(request\.id\)/.test(store),
);

/* ------------------------------------------------------------------ */
console.log("\n# 3. Il modulo non mente\n");
/* ------------------------------------------------------------------ */

check(
  "Richieste: niente conferma se non e' nata",
  /const nata = await createRequest\([\s\S]{0,600}if \(!nata\) return;/.test(richieste),
  "il messaggio «Richiesta inviata» partiva sempre, anche a scrittura fallita",
);
check(
  "Ferie: idem",
  /const nata = await createLeave\([\s\S]{0,600}if \(!nata\) return;/.test(ferie),
);
check(
  "E il modulo non si svuota: quello che si era scritto serve ancora",
  /if \(!nata\) return;\s*\n\s*setTitle\(""\)/.test(richieste),
);

/* ------------------------------------------------------------------ */
console.log("\n# 4. Il progetto scelto arriva davvero al database\n");
/* ------------------------------------------------------------------ */

check(
  "insertTaskRequest manda project_id",
  /project_id: r\.project_id \?\? null/.test(queries),
  "la colonna esiste da M2, ma questa riga mancava: il progetto si perdeva in silenzio",
);

/* ------------------------------------------------------------------ */
console.log("\n# 5. Un avviso o porta da qualche parte, o non finge\n");
/* ------------------------------------------------------------------ */

check(
  "La campanella sa andare oltre i task",
  /n\.task_id \? `\/tasks\?task=\$\{n\.task_id\}` : \(n\.link \?\? null\)/.test(campanella),
  "il gestore si chiamava openTask e navigava solo con un task_id",
);
check(
  "Senza destinazione la riga NON e' un pulsante",
  /const Riga = dove \? "button" : "div"/.test(campanella),
  "un comando che sembra tale e non fa niente insegna a non fidarsi anche di quelli veri",
);
check(
  "E senza destinazione niente hover ne' anello del fuoco",
  /dove &&\s*"hover:bg-accent\/70 focus-visible:ring-2/.test(campanella),
);
check(
  "Resta comunque un modo di segnare letto",
  /Segna letto/.test(campanella),
  "era l'unica cosa che quel clic faceva davvero: toglierla sarebbe una perdita",
);
check(
  "L'invito dice DOVE si va, non solo che si va",
  /Apri le richieste/.test(campanella) && /Apri ferie e permessi/.test(campanella),
);
check(
  "Gli avvisi di richiesta nascono con la destinazione",
  /link: "\/requests"/.test(senzaCommenti("lib/store.tsx")),
);

/* ------------------------------------------------------------------ */
console.log("\n# 6. La colonna nuova non diventa un buco\n");
/* ------------------------------------------------------------------ */

check(
  "Solo percorsi relativi",
  /link ~ '\^\/\[A-Za-z0-9\/_\?=&\.,%-\]\*\$' and link !~ '\^\/\/'/.test(m17),
  "il valore lo scrive il browser e finisce in router.push: senza vincolo si esce dall'app",
);
check(
  "Un avviso ricevuto non si riscrive",
  /new\.link is distinct from old\.link/.test(m17),
  "la guardia di M2 e' una lista di divieti: cio' che e' stato aggiunto dopo era rimasto fuori",
);
check(
  "Chiusa anche dedupe_key, che era scoperta da M5",
  /new\.dedupe_key is distinct from old\.dedupe_key/.test(m17),
  "il destinatario poteva riscriverla, e con essa la deduplicazione degli avvisi automatici",
);
check(
  "Le escalation del lavoro pianificato portano dove si decide",
  /'\/requests'/.test(m17) && /'\/leave'/.test(m17),
);
check(
  "run_escalations si ridefinisce in un file NUOVO",
  /create or replace function public\.run_escalations/.test(m17),
  "toccare M5 non servirebbe: una migrazione gia' applicata nessuno la riesegue",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
