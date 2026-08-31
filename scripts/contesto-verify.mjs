/**
 * Verifica che un pezzo non resti mai senza il suo contesto.
 *
 * Il caso reale: «Inserimento video - prodotti nuovi» aveva un brief di
 * 495 caratteri — chi l'aveva chiesto, quali prodotti, quali lingue — ed
 * era spezzato in tre pezzi affidati a Klea e Lorenzo. I pezzi nascevano
 * col solo titolo, e il pannello calcolava il padre ma non lo disegnava
 * mai. Klea apriva «Check video prodotto disponibili» e vedeva un titolo
 * secco: il brief esisteva, intero, ma per lei era irraggiungibile — e il
 * padre, essendo di Lorenzo, non le compariva nemmeno in board.
 *
 *   node scripts/contesto-verify.mjs
 */

import { contestoDelPezzo } from "../lib/contesto.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/* Il caso vero, con i dati veri. */
const padre = {
  id: "p1",
  title: "Inserimento video - prodotti nuovi",
  description:
    "Come richiesto da Claudio,\ne' necessario integrare nelle schede prodotto i video realizzati da riccardo.",
  owner_id: "lorenzo",
  status: "todo",
};
const pezzo = {
  id: "f1",
  title: "Check video prodotto disponibili",
  description: null,
  owner_id: "klea",
  parent_id: "p1",
  status: "todo",
};
const indipendente = { id: "x1", title: "Newsletter", parent_id: null };

console.log("\n# Il pezzo trova il suo lavoro\n");

{
  const c = contestoDelPezzo(pezzo, [padre, pezzo]);
  check("Un pezzo trova il padre", c !== null);
  check("…ed è quello giusto", c?.padre.id === "p1", c?.padre.title);
  check(
    "…con la richiesta per intero",
    c?.richiesta?.includes("Claudio") && c?.richiesta?.includes("riccardo"),
  );
  check(
    "La richiesta non viene troncata",
    c?.richiesta?.length === padre.description.length,
    `${c?.richiesta?.length} caratteri`,
  );
}

check(
  "Un lavoro senza padre non mostra niente",
  contestoDelPezzo(indipendente, [padre, pezzo, indipendente]) === null,
);

check(
  "Un padre che non c'è non fa esplodere niente",
  contestoDelPezzo({ parent_id: "sparito" }, [padre, pezzo]) === null,
);

console.log("\n# Il padre si raggiunge anche se non è tuo\n");

{
  /* Il punto che ha causato il guasto: da quando ognuno apre il CRM sui
     propri lavori, la board di Klea non contiene il padre di Lorenzo. Se
     il contesto lo cercasse lì dentro, non lo troverebbe mai. */
  const elencoCompleto = [padre, pezzo];
  const boardDiKlea = elencoCompleto.filter((t) => t.owner_id === "klea");

  check(
    "La board di Klea infatti NON contiene il padre",
    !boardDiKlea.some((t) => t.id === "p1"),
  );
  check(
    "…ma il contesto lo trova lo stesso, perché legge l'elenco intero",
    contestoDelPezzo(pezzo, elencoCompleto)?.padre.id === "p1",
  );
}

console.log("\n# Una richiesta vuota non finge di esserci\n");

check(
  "Padre senza descrizione: nessuna richiesta",
  contestoDelPezzo(pezzo, [{ ...padre, description: null }, pezzo])
    ?.richiesta === null,
);
check(
  "Padre con soli spazi: nessuna richiesta",
  contestoDelPezzo(pezzo, [{ ...padre, description: "   \n  " }, pezzo])
    ?.richiesta === null,
);
check(
  "…ma il padre resta comunque raggiungibile",
  contestoDelPezzo(pezzo, [{ ...padre, description: null }, pezzo])?.padre
    .id === "p1",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
