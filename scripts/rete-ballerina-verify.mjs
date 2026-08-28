/**
 * Verifica del comportamento quando la rete singhiozza.
 *
 * Il difetto segnalato: Riccardo, da Calendario, scriveva il titolo di un
 * task, salvava, e saltuariamente leggeva «TypeError: load failed / L'app è
 * tornata com'era prima». Stessa cosa sulle ferie. Non era il salvataggio a
 * essere rifiutato: era la richiesta a non partire — e noi buttavamo via il
 * suo lavoro al primo tentativo andato storto.
 *
 * Qui si simula una rete che cade una volta sola e si controlla che il
 * secondo tentativo salvi davvero, che un rifiuto del database NON venga
 * riprovato, e che l'ordine della coda regga anche in mezzo ai ritentativi.
 *
 *   node scripts/rete-ballerina-verify.mjs
 */

import { conRitentativi, eProblemaDiRete } from "../lib/riprova.ts";
import { messaggioErrore } from "../lib/errori.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/* Nelle prove non si aspetta davvero: le pause vere servono alla rete, non
   a noi. */
const subito = { dormi: async () => {} };

/* --- Riconoscere di cosa si tratta ----------------------------------- */
console.log("\n# Distinguere la rete dal rifiuto\n");

const safari = new TypeError("Load failed");
const chrome = new TypeError("Failed to fetch");
const firefox = new TypeError("NetworkError when attempting to fetch resource.");

check("Safari: «Load failed» è rete", eProblemaDiRete(safari));
check("Chrome: «Failed to fetch» è rete", eProblemaDiRete(chrome));
check("Firefox: «NetworkError…» è rete", eProblemaDiRete(firefox));

check(
  "Una policy che rifiuta NON è rete",
  !eProblemaDiRete({ code: "42501", message: "new row violates row-level security policy" }),
);
check(
  "Una chiave esterna violata NON è rete",
  !eProblemaDiRete({ code: "23503", message: "violates foreign key constraint" }),
);
check(
  "La ricorsione di una policy NON è rete",
  !eProblemaDiRete({ code: "42P17", message: "infinite recursion detected in policy" }),
);

/* Questo è il controllo che protegge dal mascherare i bug nostri: un
   TypeError di programmazione non deve diventare «controlla la rete». */
check(
  "Un bug nostro NON viene scambiato per un problema di rete",
  !eProblemaDiRete(new TypeError("Cannot read properties of undefined (reading 'id')")),
);

/* --- Cosa legge l'utente --------------------------------------------- */
console.log("\n# Il messaggio a schermo\n");

check(
  "«TypeError: load failed» non arriva più all'utente",
  !messaggioErrore(safari, "ripiego").toLowerCase().includes("load failed"),
);
check(
  "…e al suo posto si dice cosa fare",
  messaggioErrore(safari, "ripiego").includes("Connessione"),
  messaggioErrore(safari, "ripiego"),
);
check(
  "Il motivo vero di un rifiuto resta invece intatto",
  messaggioErrore({ code: "42501", message: "violates row-level security policy" }, "r").includes(
    "42501",
  ),
);

/* --- Riprovare ------------------------------------------------------- */
console.log("\n# Il ritentativo\n");

{
  let tentativi = 0;
  const risultato = await conRitentativi(async () => {
    tentativi++;
    if (tentativi === 1) throw new TypeError("Load failed");
    return "salvato";
  }, subito);
  check("Una rete che cade una volta non perde il lavoro", risultato === "salvato");
  check("…ed è bastato un secondo tentativo", tentativi === 2, `tentativi: ${tentativi}`);
}

{
  let tentativi = 0;
  try {
    await conRitentativi(async () => {
      tentativi++;
      throw { code: "42501", message: "policy" };
    }, subito);
  } catch {
    /* atteso */
  }
  check("Un no del database non si riprova", tentativi === 1, `tentativi: ${tentativi}`);
}

{
  let tentativi = 0;
  try {
    await conRitentativi(async () => {
      tentativi++;
      throw new TypeError("Load failed");
    }, subito);
    check("Una rete sempre giù finisce per fallire", false);
  } catch (e) {
    check("Una rete sempre giù finisce per fallire", true);
    check("…dopo tre tentativi, non all'infinito", tentativi === 3, `tentativi: ${tentativi}`);
    check(
      "…e lo dice in italiano",
      messaggioErrore(e, "ripiego").includes("Connessione"),
    );
  }
}

{
  /* La risposta persa: la riga era arrivata, il database la ritrova già
     lì al secondo giro. Non è un errore, è la conferma. */
  let tentativi = 0;
  let errore = null;
  try {
    await conRitentativi(async () => {
      tentativi++;
      if (tentativi === 1) throw new TypeError("Load failed");
      throw { code: "23505", message: "duplicate key value violates unique constraint" };
    }, subito);
  } catch (e) {
    errore = e;
  }
  check("Una risposta persa non diventa un errore", errore === null);
}

/* --- L'ordine regge anche riprovando --------------------------------- */
console.log("\n# La coda, con la rete che balla\n");

{
  /* La coda dello store, con il ritentativo dentro il turno — esattamente
     come in lib/store.tsx. */
  let coda = Promise.resolve();
  function inCoda(operazione) {
    const conRete = () => conRitentativi(operazione, subito);
    const risultato = coda.then(conRete, conRete);
    coda = risultato.catch(() => undefined);
    return risultato;
  }

  const arrivi = [];
  let primaFallita = false;

  /* Il task cade una volta; la sua cronologia parte subito dopo. Se il
     ritentativo uscisse dalla coda, la cronologia arriverebbe per prima e
     la chiave esterna la respingerebbe — il bug di partenza. */
  const task = inCoda(async () => {
    if (!primaFallita) {
      primaFallita = true;
      throw new TypeError("Load failed");
    }
    arrivi.push("task");
  });
  const cronologia = inCoda(async () => {
    arrivi.push("cronologia");
  });

  await Promise.allSettled([task, cronologia]);

  check(
    "Il task arriva prima della sua cronologia, anche dopo un ritentativo",
    arrivi.join(" → ") === "task → cronologia",
    arrivi.join(" → "),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
