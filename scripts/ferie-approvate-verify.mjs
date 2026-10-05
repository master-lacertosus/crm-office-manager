/**
 * Un'assenza approvata si può correggere o togliere — da un responsabile,
 * non sulla propria, e mai in silenzio.
 *
 * La richiesta dell'ufficio: «poter rimuovere o modificare le ferie
 * approvate dei dipendenti». Il database lo permetteva già da M9 (policy
 * `leave_update_pending_or_admin` e `leave_delete_own_pending_or_admin`):
 * mancava solo il comando. Questa prova tiene insieme le quattro cose che
 * rendono il comando onesto:
 *
 *   1. il database lo permette davvero a un responsabile, e solo a lui;
 *   2. una scrittura negata dalla RLS NON passa per fatta (la RLS non dà
 *      errore: restituisce zero righe);
 *   3. il dipendente viene avvisato, e una rimozione si motiva;
 *   4. il comando si vede, senza hover, ed è dove si cercano le assenze.
 *
 *   node scripts/ferie-approvate-verify.mjs
 */
import { readFileSync } from "node:fs";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const sql = readFileSync("supabase/AGGIORNA-DATABASE.sql", "utf8");
const m2 = readFileSync("supabase/migrations/20260813120000_m2_domain.sql", "utf8");
const queries = readFileSync("lib/supabase/queries.ts", "utf8");
const store = readFileSync("lib/store.tsx", "utf8");
const ferie = readFileSync("components/leave-content.tsx", "utf8");

/** Il corpo di un metodo dello store, fino al metodo successivo. */
function corpo(nome) {
  const i = store.indexOf(`async ${nome}(`);
  if (i < 0) return "";
  const j = store.indexOf("\n    async ", i + 10);
  const k = store.indexOf("\n    closures,", i);
  return store.slice(i, Math.min(...[j, k].filter((n) => n > 0)));
}

/* ------------------------------------------------------------------ */
console.log("\n# Il database: un responsabile può, un dipendente no\n");
/* ------------------------------------------------------------------ */

check(
  "Modificare un'assenza decisa: solo un responsabile",
  /create policy leave_update_pending_or_admin[\s\S]{0,400}public\.is_admin\(\)[\s\S]{0,200}status = 'pending'/.test(
    sql,
  ),
  "se un dipendente potesse, allungherebbe da sé le ferie già approvate",
);
check(
  "Cancellare un'assenza decisa: solo un responsabile",
  /create policy leave_delete_own_pending_or_admin[\s\S]{0,300}public\.is_admin\(\)[\s\S]{0,200}status = 'pending'/.test(
    m2,
  ),
);

/* ------------------------------------------------------------------ */
console.log("\n# Una scrittura negata non passa per fatta\n");
/* ------------------------------------------------------------------ */

for (const fn of ["updateLeaveRange", "removeLeaveRequest"]) {
  const i = queries.indexOf(`export async function ${fn}(`);
  const testo = i < 0 ? "" : queries.slice(i, queries.indexOf("\n}\n", i));
  check(
    `${fn} chiede indietro la riga toccata`,
    /\.select\("id"\)/.test(testo) && /if \(!data\?\.length\) throw/.test(testo),
    "la RLS nega con zero righe e nessun errore: senza questo controllo il toast mentirebbe",
  );
}

for (const nome of ["modifyLeave", "removeLeave"]) {
  const c = corpo(nome);
  check(`${nome} esiste nello store`, c.length > 0);
  check(
    `${nome}: un responsabile, e non sulla propria assenza`,
    /currentUser\.role !== "admin" \|\| leave\.requester_id === currentUser\.id/.test(c),
    "stessa regola della decisione: allungarsi le ferie sarebbe approvarsele",
  );
  const attesa = c.search(/await (updateLeaveRange|removeLeaveRequest)\(/);
  const stato = c.indexOf("setLeaves(");
  const avviso = c.indexOf("avvisaSullAssenza(");
  check(
    `${nome}: aspetta il database, POI cambia il calendario e avvisa`,
    attesa > 0 && stato > attesa && avviso > attesa,
    `await @${attesa}, setLeaves @${stato}, avviso @${avviso}`,
  );
  check(
    `${nome}: su errore dice false, non annuncia`,
    /catch \(e\) \{\s*setSyncError\([\s\S]{0,120}\);\s*return false;/.test(c),
  );
}

check(
  "Una rimozione si motiva",
  /if \(!trimmed\) \{\s*setSyncError/.test(corpo("removeLeave")),
  "chi si vede togliere ferie già concesse deve sapere perché",
);
check(
  "La modifica non accavalla le date su un'altra assenza della stessa persona",
  /l\.id !== id &&\s*l\.requester_id === leave\.requester_id[\s\S]{0,120}rangesOverlap/.test(
    corpo("modifyLeave"),
  ),
);
check(
  "L'avviso porta alla pagina Ferie",
  /avvisaSullAssenza[\s\S]{0,1200}link: "\/leave"/.test(store),
  "senza link la campanella resta inerte: si preme e non succede niente",
);

/* ------------------------------------------------------------------ */
console.log("\n# L'interfaccia: il comando si vede, e il toast arriva dopo\n");
/* ------------------------------------------------------------------ */

check(
  "Il toast parte solo se il salvataggio è riuscito",
  /if \(!fatto\) return;\s*toast\(\s*mode === "modify"/.test(ferie),
);
check(
  "Rimuovi resta spento senza motivo",
  /const removeBlocked = !note\.trim\(\);/.test(ferie),
);
check(
  "Modifica e Rimuovi sono pulsanti con testo, non icone a comparsa",
  />\s*Modifica\s*</.test(ferie) && />\s*Rimuovi\s*</.test(ferie) &&
    !/opacity-0[^"]*group-hover/.test(ferie),
);
check(
  "Le approvate in arrivo hanno una sezione tutta loro",
  /title="Assenze approvate"/.test(ferie) &&
    /l\.status === "approved" && l\.end_date >= todayIso\(\)/.test(ferie),
  "«Decise di recente» ne mostra otto: quella da correggere poteva non esserci",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
