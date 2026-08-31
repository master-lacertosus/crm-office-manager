/**
 * L'agenda risponde alla domanda giusta.
 *
 * Richiesta: «vorrei vedere le task che ho entro un determinato giorno o
 * range di date da completare, eventualmente retroattive completate».
 *
 * I Report non potevano farlo — e non per una svista: misurano
 * `completed_at`, quindi sono retrospettivi per costruzione, e un
 * intervallo futuro avrebbe dato pagine vuote. Togliere il tetto sulle date
 * senza altro avrebbe prodotto un filtro che accetta il futuro e non
 * risponde niente.
 *
 *   node scripts/agenda-verify.mjs
 */

import { costruisciAgenda } from "../lib/agenda.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const OGGI = "2026-08-31";
const t = (title, due_date, extra = {}) => ({
  id: title,
  title,
  due_date,
  status: "todo",
  position: 1,
  archived_at: null,
  ...extra,
});

const LAVORI = [
  t("Scaduto la settimana scorsa", "2026-08-24"),
  t("Scaduto ieri", "2026-08-30"),
  t("Oggi A", OGGI),
  t("Oggi B", OGGI, { position: 0 }),
  t("Domani", "2026-09-01"),
  t("Fra una settimana", "2026-09-07"),
  t("Fra un mese", "2026-10-01"),
  t("Chiuso ieri", "2026-08-30", { status: "done" }),
  t("Senza data", null),
  t("Archiviato", OGGI, { archived_at: "2026-08-30T10:00:00Z" }),
];

console.log("\n# Guardare avanti\n");

{
  const a = costruisciAgenda(LAVORI, {
    da: OGGI,
    a: "2026-09-07",
    oggi: OGGI,
  });
  check(
    "Si vede cosa scade da oggi a fine settimana",
    a.giorni.map((g) => g.giorno).join(",") ===
      "2026-08-31,2026-09-01,2026-09-07",
    a.giorni.map((g) => g.giorno).join(","),
  );
  check(
    "Il mese prossimo resta fuori",
    !a.giorni.some((g) => g.lavori.some((l) => l.title === "Fra un mese")),
  );
  check(
    "Gli arretrati si vedono lo stesso, in cima",
    a.arretrati.map((x) => x.title).join(" | ") ===
      "Scaduto la settimana scorsa | Scaduto ieri",
    a.arretrati.map((x) => x.title).join(" | "),
  );
  check(
    "…e sono in ordine di scadenza, dal piu' vecchio",
    a.arretrati[0].title === "Scaduto la settimana scorsa",
  );
}

console.log("\n# Un giorno solo\n");

{
  const a = costruisciAgenda(LAVORI, { da: OGGI, a: OGGI, oggi: OGGI });
  check("«Oggi» mostra un giorno solo", a.giorni.length === 1);
  check(
    "…con i lavori di oggi",
    a.giorni[0].lavori.length === 2,
    `${a.giorni[0].lavori.length} lavori`,
  );
  check(
    "…nello stesso ordine di board ed elenco (posizione)",
    a.giorni[0].lavori.map((l) => l.title).join(",") === "Oggi B,Oggi A",
    a.giorni[0].lavori.map((l) => l.title).join(","),
  );
}

console.log("\n# Guardare indietro, con quello che è stato chiuso\n");

{
  const senza = costruisciAgenda(LAVORI, {
    da: "2026-08-24",
    a: OGGI,
    oggi: OGGI,
  });
  check(
    "Di norma le cose chiuse non ingombrano",
    !senza.giorni.some((g) => g.lavori.some((l) => l.title === "Chiuso ieri")),
  );

  const con = costruisciAgenda(LAVORI, {
    da: "2026-08-24",
    a: OGGI,
    oggi: OGGI,
    includiCompletate: true,
  });
  check(
    "Chiedendole, ricompaiono nel loro giorno",
    con.giorni.some((g) => g.lavori.some((l) => l.title === "Chiuso ieri")),
  );
  check(
    "Un lavoro chiuso non e' un arretrato",
    !con.arretrati.some((x) => x.title === "Chiuso ieri"),
  );
}

console.log("\n# Niente doppioni, niente sparizioni\n");

{
  /* Se l'intervallo comprende gia' gli scaduti, quelli stanno nel loro
     giorno: metterli anche fra gli arretrati li mostrerebbe due volte. */
  const a = costruisciAgenda(LAVORI, {
    da: "2026-08-01",
    a: "2026-09-30",
    oggi: OGGI,
  });
  check(
    "Uno scaduto dentro l'intervallo non compare due volte",
    a.arretrati.length === 0,
    `${a.arretrati.length} arretrati`,
  );
  check(
    "…ma e' comunque nel suo giorno",
    a.giorni.some((g) =>
      g.lavori.some((l) => l.title === "Scaduto la settimana scorsa"),
    ),
  );
  check("Gli archiviati non si vedono mai", !JSON.stringify(a).includes("Archiviato"));
  check(
    "Chi non ha una data non compare fra i giorni",
    !a.giorni.some((g) => g.lavori.some((l) => l.title === "Senza data")),
  );
  check(
    "…ma si puo' chiedere di vederlo a parte",
    costruisciAgenda(LAVORI, {
      da: OGGI,
      a: OGGI,
      oggi: OGGI,
      includiSenzaData: true,
    }).senzaData.length === 1,
  );
}

console.log("\n# Dettagli che capitano davvero\n");

{
  const rovesciato = costruisciAgenda(LAVORI, {
    da: "2026-09-07",
    a: OGGI,
    oggi: OGGI,
  });
  check(
    "Un intervallo scritto al contrario si legge come inteso",
    rovesciato.giorni.length === 3,
    `${rovesciato.giorni.length} giorni`,
  );

  const vuoto = costruisciAgenda(LAVORI, {
    da: "2027-01-01",
    a: "2027-01-31",
    oggi: OGGI,
  });
  check("Un intervallo senza lavori non esplode", vuoto.giorni.length === 0);
  check(
    "…e gli arretrati restano visibili anche li'",
    vuoto.arretrati.length === 2,
    `${vuoto.arretrati.length}`,
  );

  const a = costruisciAgenda(LAVORI, { da: OGGI, a: "2026-09-07", oggi: OGGI });
  check(
    "Il totale conta tutto quello che si vede",
    a.totale ===
      a.arretrati.length + a.giorni.reduce((n, g) => n + g.lavori.length, 0),
  );
  check(
    "I giorni senza niente non compaiono",
    a.giorni.every((g) => g.lavori.length > 0),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
