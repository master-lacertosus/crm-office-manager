/**
 * Il pezzo scritto e non confermato non si perde.
 *
 * Il riquadro «Pezzi di questo lavoro» tiene una riga di bozza, e il pezzo
 * entrava nell'elenco solo premendo Invio o il «+». Chi compilava quella
 * riga e poi cliccava «Crea task» — il gesto che conclude tutto il resto
 * del modulo — se lo vedeva scartare senza un avviso.
 *
 * Quanto fosse comune lo dice il database: in tutta la vita del prodotto
 * nessun pezzo era mai nato insieme al suo lavoro (il piu' vicino, 18
 * secondi dopo, era stato aggiunto a mano dopo), mentre nove erano stati
 * aggiunti in un secondo momento. La funzione serviva; era il gesto per
 * confermarla a non arrivare mai.
 *
 *   node scripts/pezzi-verify.mjs
 */

import { BOZZA_VUOTA, pezziDaSalvare } from "../lib/pezzi.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const IO = "io";
const KLEA = "klea";
const confermato = { chiave: "k1", titolo: "Riprese", owner_id: KLEA };

console.log("\n# La bozza vale come un pezzo\n");

{
  const r = pezziDaSalvare([], { titolo: "Montaggio", owner_id: KLEA }, "n1", IO);
  check("Una bozza da sola diventa un pezzo", r.length === 1);
  check("…con il suo titolo", r[0]?.titolo === "Montaggio", r[0]?.titolo);
  check("…e con chi era stato scelto", r[0]?.owner_id === KLEA, r[0]?.owner_id);
}

{
  const r = pezziDaSalvare(
    [confermato],
    { titolo: "Montaggio", owner_id: KLEA },
    "n1",
    IO,
  );
  check("La bozza si aggiunge ai pezzi gia' confermati", r.length === 2);
  check("…in coda, senza toccare i primi", r[0]?.chiave === "k1");
}

console.log("\n# Quando non c'e' niente da raccogliere\n");

check(
  "Nessuna bozza: l'elenco resta quello",
  pezziDaSalvare([confermato], BOZZA_VUOTA, "n1", IO).length === 1,
);
check(
  "Bozza di soli spazi: non diventa un pezzo",
  pezziDaSalvare([], { titolo: "   ", owner_id: KLEA }, "n1", IO).length === 0,
);
check(
  "Niente pezzi e niente bozza: niente da creare",
  pezziDaSalvare([], BOZZA_VUOTA, "n1", IO).length === 0,
);

console.log("\n# Il responsabile\n");

{
  /* Chi scrive il titolo e non tocca il menu non sta dicendo «nessuno»:
     un pezzo senza responsabile il database lo rifiuta. */
  const r = pezziDaSalvare([], { titolo: "Montaggio", owner_id: "" }, "n1", IO);
  check("Menu mai toccato: il pezzo va al predefinito", r[0]?.owner_id === IO);
  check("…e non resta vuoto", r[0]?.owner_id !== "");
}

console.log("\n# Chi riscrive per sicurezza\n");

{
  /* Capita: si aggiunge il pezzo col «+», poi lo si riscrive nella riga
     perche' non si e' sicuri che sia stato preso. Non deve nascere due
     volte. */
  const r = pezziDaSalvare(
    [confermato],
    { titolo: "Riprese", owner_id: KLEA },
    "n1",
    IO,
  );
  check("Una bozza uguale a un pezzo gia' presente non lo duplica", r.length === 1);
  const r2 = pezziDaSalvare(
    [confermato],
    { titolo: "  riprese  ", owner_id: KLEA },
    "n1",
    IO,
  );
  check("…nemmeno con spazi o maiuscole diverse", r2.length === 1);
}

console.log("\n# Non si tocca quello che c'era\n");

{
  const originale = [confermato];
  const r = pezziDaSalvare(originale, { titolo: "Altro", owner_id: KLEA }, "n1", IO);
  check("L'elenco di partenza non viene modificato", originale.length === 1);
  check("…e il risultato e' un elenco nuovo", r !== originale);
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
