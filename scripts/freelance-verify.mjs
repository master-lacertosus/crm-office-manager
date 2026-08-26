/**
 * Il calendario di chi non ha la settimana dell'ufficio.
 *
 * Il difetto: `workingDaysCount` saltava sempre sabato e domenica, e il
 * modulo delle assenze manda solo se i giorni sono piu' di zero. Un
 * freelance che voleva segnare un sabato si trovava il pulsante spento,
 * senza nemmeno una riga che spiegasse perche'.
 *
 * Qui si controlla che il conteggio cambi con il ruolo, e che tutto il
 * resto resti com'era per chi la settimana ce l'ha.
 *
 *   node scripts/freelance-verify.mjs
 */
import { workingDaysCount } from "../lib/leave.ts";
import { lavoraNelWeekend, RUOLI } from "../lib/types.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/* 2026-08-29 e' un sabato, il 30 una domenica, il 31 un lunedi'. */
const SABATO = "2026-08-29";
const DOMENICA = "2026-08-30";
const LUNEDI = "2026-08-31";
const VENERDI = "2026-08-28";

const senzaChiusure = [];

/* --- 1. Il ruolo decide se il weekend conta ------------------------- */
check(
  "Un dipendente non ha giorni da segnare di sabato",
  workingDaysCount(SABATO, SABATO, senzaChiusure, false) === 0,
  "0 giorni: il modulo lo rifiuta, ed e' giusto cosi'",
);
check(
  "Un freelance sul sabato ha un giorno",
  workingDaysCount(SABATO, SABATO, senzaChiusure, true) === 1,
  "1 giorno: il modulo lo accetta",
);
check(
  "Un freelance su sabato+domenica ha due giorni",
  workingDaysCount(SABATO, DOMENICA, senzaChiusure, true) === 2,
);

/* --- 2. Per chi ha la settimana non cambia niente -------------------- */
check(
  "Settimana intera, dipendente: restano 5 giorni",
  workingDaysCount("2026-08-24", "2026-08-30", senzaChiusure, false) === 5,
  "lunedi'-venerdi'",
);
check(
  "Settimana intera, freelance: sono 7",
  workingDaysCount("2026-08-24", "2026-08-30", senzaChiusure, true) === 7,
);
check(
  "Da venerdi' a lunedi', dipendente: 2",
  workingDaysCount(VENERDI, LUNEDI, senzaChiusure, false) === 2,
);
check(
  "Da venerdi' a lunedi', freelance: 4",
  workingDaysCount(VENERDI, LUNEDI, senzaChiusure, true) === 4,
);

/* --- 3. Le chiusure aziendali valgono per tutti --------------------- */
{
  const chiusura = [{ start_date: SABATO, end_date: SABATO }];
  check(
    "Una chiusura toglie il giorno anche al freelance",
    workingDaysCount(SABATO, SABATO, chiusura, true) === 0,
    "se l'ufficio ha chiuso, non si consumano ferie",
  );
  const natale = [{ start_date: "2026-12-24", end_date: "2026-12-26" }];
  check(
    "La chiusura vale anche per chi ha la settimana",
    workingDaysCount("2026-12-24", "2026-12-24", natale, false) === 0,
  );
}

/* --- 4. Il ripiego, quando il conteggio non ha senso ---------------- */
check(
  "Fine prima dell'inizio: zero, non un numero a caso",
  workingDaysCount(LUNEDI, VENERDI, senzaChiusure, true) === 0,
);

/* --- 5. Chi lavora nel weekend, secondo il ruolo -------------------- */
check(
  "Solo il freelance lavora nel weekend",
  lavoraNelWeekend("freelance") === true &&
    lavoraNelWeekend("member") === false &&
    lavoraNelWeekend("admin") === false,
);

/* --- 6. Ogni ruolo ha la sua etichetta ------------------------------ */
{
  const chiavi = Object.keys(RUOLI).sort().join(",");
  check(
    "I tre ruoli hanno etichetta e spiegazione",
    chiavi === "admin,freelance,member" &&
      Object.values(RUOLI).every((r) => r.label && r.hint),
    chiavi,
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
