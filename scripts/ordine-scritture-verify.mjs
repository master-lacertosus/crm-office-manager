/**
 * Verifica dell'ordine delle scritture e del messaggio d'errore.
 *
 * Il difetto: creando un task, la sua voce di cronologia partiva insieme al
 * task e poteva arrivare prima — con la chiave esterna che la respingeva.
 * Qui si riproduce la corsa con un finto database lento e si controlla che
 * l'ordine sia quello giusto.
 *
 *   node scripts/ordine-scritture-verify.mjs
 */

import { messaggioErrore } from "../lib/errori.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- La coda, identica a quella dello store -------------------------- */
let coda = Promise.resolve();
function inCoda(operazione) {
  const risultato = coda.then(operazione, operazione);
  coda = risultato.catch(() => undefined);
  return risultato;
}

/* --- Finto database: rifiuta la cronologia se il task non c'è -------- */
function creaDatabase() {
  const tasks = new Set();
  const eventi = [];
  const ordine = [];
  return {
    ordine,
    eventi,
    // Il task è lento: è la scrittura pesante, quella che la cronologia
    // scavalcava.
    async inserisciTask(id, ritardo) {
      await attesa(ritardo);
      tasks.add(id);
      ordine.push(`task:${id}`);
    },
    async inserisciEvento(taskId) {
      await attesa(1);
      if (!tasks.has(taskId)) {
        const errore = {
          message: 'insert or update on table "task_events" violates foreign key constraint',
          details: `Key (task_id)=(${taskId}) is not present in table "tasks".`,
          code: "23503",
        };
        throw errore;
      }
      eventi.push(taskId);
      ordine.push(`evento:${taskId}`);
    },
  };
}

/* --- 1. Senza coda: la cronologia arriva prima e viene respinta ------ */
{
  const db = creaDatabase();
  let respinto = null;
  const scritturaTask = db.inserisciTask("t1", 30);
  const scritturaEvento = db.inserisciEvento("t1").catch((e) => {
    respinto = e;
  });
  await Promise.all([scritturaTask, scritturaEvento]);
  check(
    "Senza coda la cronologia scavalca il task e il database la respinge",
    respinto !== null && respinto.code === "23503",
    respinto ? `codice ${respinto.code}` : "nessun rifiuto: la prova non riproduce il difetto",
  );
}

/* --- 2. Con la coda: ordine garantito, nessun rifiuto ---------------- */
{
  const db = creaDatabase();
  let respinto = null;
  void inCoda(() => db.inserisciTask("t2", 30));
  const evento = inCoda(() => db.inserisciEvento("t2")).catch((e) => {
    respinto = e;
  });
  await evento;
  check(
    "Con la coda il task arriva per primo",
    db.ordine.join(" → ") === "task:t2 → evento:t2",
    db.ordine.join(" → ") || "nessuna scrittura",
  );
  check("Con la coda nessuna scrittura viene respinta", respinto === null);
}

/* --- 3. Un errore non blocca le scritture successive ----------------- */
{
  const db = creaDatabase();
  void inCoda(() => db.inserisciEvento("mai-creato")).catch(() => {});
  void inCoda(() => db.inserisciTask("t3", 5));
  await inCoda(() => db.inserisciEvento("t3"));
  check(
    "Dopo un rifiuto la coda prosegue",
    db.eventi.includes("t3"),
    db.ordine.join(" → "),
  );
}

/* --- 4. Il messaggio dice il motivo vero ----------------------------- */
{
  const errore = {
    message: 'new row violates row-level security policy for table "tasks"',
    code: "42501",
  };
  const testo = messaggioErrore(errore, "Salvataggio non riuscito.");
  check(
    "Il motivo del database arriva all'utente, con il suo codice",
    testo.includes("row-level security") && testo.includes("42501"),
    testo,
  );
  check(
    "Un errore senza forma riconoscibile usa il ripiego",
    messaggioErrore(null, "Salvataggio non riuscito.") === "Salvataggio non riuscito.",
  );
  check(
    "Un errore vero di JavaScript resta leggibile",
    messaggioErrore(new Error("rete assente"), "ripiego") === "rete assente",
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
