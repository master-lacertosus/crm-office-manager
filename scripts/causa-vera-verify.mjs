/**
 * Quando il database rifiuta un task, l'utente deve leggere PERCHE'.
 *
 * Il difetto: il task viene respinto (una policy, un vincolo, una colonna),
 * ma la sua voce di cronologia era gia' in coda. Parte, e viene respinta a
 * sua volta perche' punta a una riga che non esiste — «violates foreign key
 * constraint». Quel secondo errore arriva DOPO e sovrascrive il primo:
 * a schermo resta l'eco, e la causa non si vede mai.
 *
 * Qui si riproduce la sequenza con un database finto e si controlla che
 * dopo la correzione resti a schermo il motivo vero.
 *
 *   node scripts/causa-vera-verify.mjs
 */

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

/* --- L'insieme dei task mai nati, identico allo store ---------------- */
function creaRegistro() {
  const maiNati = new Set();
  return {
    segna: (id) => maiNati.add(id),
    senzaOrfani: (righe) =>
      maiNati.size === 0 ? righe : righe.filter((r) => !maiNati.has(r.task_id)),
  };
}

/* --- Finto database: rifiuta il task, e poi la cronologia orfana ----- */
function creaDatabase({ motivoRifiuto }) {
  const tasks = new Set();
  return {
    async inserisciTask(id) {
      await attesa(5);
      if (motivoRifiuto) throw motivoRifiuto;
      tasks.add(id);
    },
    async inserisciEventi(eventi) {
      await attesa(1);
      if (eventi.length === 0) return; // niente da scrivere: nessun viaggio
      for (const e of eventi) {
        if (!tasks.has(e.task_id)) {
          throw {
            message:
              'insert or update on table "task_events" violates foreign key constraint "task_events_task_id_fkey"',
            details: `Key (task_id)=(${e.task_id}) is not present in table "tasks".`,
            code: "23503",
          };
        }
      }
    },
  };
}

const RIFIUTO_POLICY = {
  message: 'new row violates row-level security policy for table "tasks"',
  code: "42501",
};

/**
 * Una creazione di task, come la fa lo store: stato ottimistico, task in
 * coda, cronologia in coda subito dopo (dall'effetto).
 */
async function creaTask({ conCorrezione, motivoRifiuto }) {
  const db = creaDatabase({ motivoRifiuto });
  const registro = creaRegistro();
  const id = "task-1";
  let eventi = [{ id: "ev-1", task_id: id }];
  let aSchermo = null;

  const scritturaTask = inCoda(() => db.inserisciTask(id)).catch((e) => {
    if (conCorrezione) {
      registro.segna(id);
      eventi = eventi.filter((ev) => ev.task_id !== id);
    }
    aSchermo = e;
  });

  const scritturaEventi = inCoda(() =>
    db.inserisciEventi(conCorrezione ? registro.senzaOrfani(eventi) : eventi),
  ).catch((e) => {
    aSchermo = e;
  });

  await Promise.all([scritturaTask, scritturaEventi]);
  return { aSchermo, eventiRimasti: eventi.length };
}

/* --- 1. Il difetto: l'eco copre la causa ----------------------------- */
{
  const { aSchermo } = await creaTask({
    conCorrezione: false,
    motivoRifiuto: RIFIUTO_POLICY,
  });
  check(
    "Senza correzione a schermo resta l'eco, non la causa",
    aSchermo?.code === "23503",
    `l'utente legge «${aSchermo?.message?.slice(0, 46)}…» invece del motivo vero`,
  );
}

/* --- 2. Con la correzione si legge il motivo vero -------------------- */
{
  const { aSchermo, eventiRimasti } = await creaTask({
    conCorrezione: true,
    motivoRifiuto: RIFIUTO_POLICY,
  });
  check(
    "Con la correzione a schermo resta la causa",
    aSchermo?.code === "42501",
    aSchermo?.message,
  );
  check(
    "La cronologia del task mai nato sparisce anche da schermo",
    eventiRimasti === 0,
    `${eventiRimasti} voci rimaste`,
  );
}

/* --- 3. Quando il task nasce, la cronologia lo segue ----------------- */
{
  const { aSchermo } = await creaTask({
    conCorrezione: true,
    motivoRifiuto: null,
  });
  check("Se il task nasce non compare nessun errore", aSchermo === null, aSchermo?.message ?? "");
}

/* --- 4. Il registro non cresce all'infinito -------------------------- */
{
  const registro = creaRegistro();
  for (let i = 0; i < 250; i++) registro.segna(`t${i}`);
  const superstiti = registro.senzaOrfani(
    Array.from({ length: 250 }, (_, i) => ({ task_id: `t${i}` })),
  );
  // Nello store l'insieme si pota a 100: qui si verifica solo che filtri
  // senza rompersi su molte voci.
  check(
    "Il filtro regge molte voci senza rompersi",
    superstiti.length === 0,
    `${superstiti.length} orfani sfuggiti`,
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
