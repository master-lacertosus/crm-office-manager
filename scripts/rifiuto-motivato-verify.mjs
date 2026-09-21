/**
 * Un rifiuto va motivato, e l'interfaccia deve saperlo prima del database.
 *
 * Il difetto segnalato: rifiutando una richiesta compariva
 *
 *   Modifica non salvata
 *   new row for relation "task_requests" violates check constraint
 *   "request_rejection_needs_reason" [23514]
 *
 * La regola -- un no si motiva -- e' giusta e sta nel database da M2. Il
 * difetto era che l'interfaccia non la conosceva: il pulsante "Conferma
 * rifiuto" partiva anche a campo vuoto, il database respingeva, e chi aveva
 * premuto leggeva il nome di un vincolo SQL invece di "scrivi il motivo".
 *
 * Peggio: il messaggio "Richiesta rifiutata: il richiedente e' stato
 * avvisato" partiva comunque, nello stesso istante dell'errore. Due
 * messaggi che si contraddicono sono peggio di un errore solo, perche'
 * lasciano chi legge senza sapere che cosa sia successo davvero.
 *
 * La stessa regola esisteva GIA' corretta per le ferie
 * (components/leave-content.tsx): era una sola delle due strade a saperlo.
 * Questa prova le tiene allineate, perche' e' esattamente il tipo di cosa
 * che diverge di nuovo al prossimo ritocco.
 *
 *   node scripts/rifiuto-motivato-verify.mjs
 */
import { readFileSync } from "node:fs";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const sql = readFileSync(
  "supabase/migrations/20260813120000_m2_domain.sql",
  "utf8",
);
const store = readFileSync("lib/store.tsx", "utf8");
const richieste = readFileSync("components/requests-content.tsx", "utf8");
const ferie = readFileSync("components/leave-content.tsx", "utf8");

/* ------------------------------------------------------------------ */
console.log("\n# La regola nel database (quella vera)\n");
/* ------------------------------------------------------------------ */

check(
  "Una richiesta rifiutata esige una motivazione",
  /constraint request_rejection_needs_reason check \(\s*status <> 'rejected' or char_length\(trim\(coalesce\(rejection_reason, ''\)\)\) > 0/.test(
    sql,
  ),
);
check(
  "Una ferie rifiutata esige una motivazione",
  /constraint leave_rejection_needs_note check \(\s*status <> 'rejected' or char_length\(trim\(coalesce\(decision_note, ''\)\)\) > 0/.test(
    sql,
  ),
  "sono la stessa regola su due tabelle: le due interfacce devono comportarsi uguale",
);

/* ------------------------------------------------------------------ */
console.log("\n# Le due interfacce si fermano prima, allo stesso modo\n");
/* ------------------------------------------------------------------ */

check(
  "Ferie: il pulsante di rifiuto e' spento senza motivo",
  /disabled=\{busy \|\| \(deciding === "reject" && !note\.trim\(\)\)\}/.test(ferie),
);
check(
  "Richieste: il pulsante di rifiuto e' spento senza motivo",
  /disabled=\{busy \|\| motivoMancante\}/.test(richieste),
  "era `disabled={busy}`: si poteva confermare un rifiuto vuoto",
);
check(
  "Richieste: anche l'Invio dalla tastiera si ferma",
  /if \(busy \|\| motivoMancante\) return;/.test(richieste),
  "il campo manda con Enter: un pulsante spento da solo non basta",
);

/* ------------------------------------------------------------------ */
console.log("\n# Non si annuncia come fatto cio' che e' stato respinto\n");
/* ------------------------------------------------------------------ */

check(
  "rejectRequest dice se ha funzionato",
  /rejectRequest: \(id: string, reason: string\) => Promise<boolean>;/.test(
    store,
  ),
  "prima tornava void: chi chiamava non aveva modo di sapere l'esito",
);
check(
  "Il messaggio di successo parte solo a rifiuto avvenuto",
  /const fatto = await rejectRequest\([\s\S]{0,400}if \(!fatto\) return;/.test(
    richieste,
  ),
  "prima il toast partiva sempre, anche accanto all'errore che diceva il contrario",
);

/* Doppia rete: anche se un domani l'interfaccia si dimenticasse il controllo,
   lo store non deve mandare al database una scrittura che sa gia' respinta. */
check(
  "Lo store rifiuta da se' un rifiuto senza motivo",
  /if \(!trimmed\) \{[\s\S]{0,200}return false;/.test(store),
  "la stessa regola del database, non una diversa",
);

/* ------------------------------------------------------------------ */
console.log("\n# L'avviso al richiedente\n");
/* ------------------------------------------------------------------ */

check(
  "Chi riceve un no legge sempre il perche'",
  /Richiesta rifiutata: «\$\{req\.title\}» — \$\{trimmed\}/.test(store),
  "il motivo ora c'e' sempre: il ramo «senza motivo» non e' piu' raggiungibile",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
