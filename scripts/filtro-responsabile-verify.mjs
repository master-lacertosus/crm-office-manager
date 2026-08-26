/**
 * Chi si vede quando non si e' chiesto niente.
 *
 * Prima l'indirizzo senza `owner` significava «tutti», per chiunque. Su una
 * board condivisa e' la scelta sbagliata per la maggior parte delle
 * persone: un dipendente apre il CRM per sapere cosa deve fare lui, e si
 * trovava davanti il lavoro di cinque colleghi da scremare a mano.
 *
 * Ora il predefinito segue il ruolo. Qui si controlla che segua quello
 * giusto, e soprattutto che nessuno resti chiuso fuori dal panorama
 * completo: deve restare a un clic.
 *
 *   node --import ./scripts/alias.mjs scripts/filtro-responsabile-verify.mjs
 */
import {
  parametroPerTutti,
  responsabileEffettivo,
  staVedendoTutti,
  TUTTI,
} from "../lib/filtro-responsabile.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const KLEA = { id: "klea", role: "member" };
const RICCARDO = { id: "riccardo", role: "freelance" };
const FRANCESCO = { id: "francesco", role: "admin" };

/* --- 1. Il predefinito, per ruolo ------------------------------------ */
check(
  "Un dipendente senza filtri vede i propri",
  responsabileEffettivo(null, KLEA) === "klea",
  "e' la sua giornata",
);
check(
  "Un freelance senza filtri vede i propri",
  responsabileEffettivo(null, RICCARDO) === "riccardo",
);
check(
  "Un responsabile senza filtri vede tutti",
  responsabileEffettivo(null, FRANCESCO) === null,
  "e' il suo mestiere",
);

/* --- 2. Il panorama completo resta raggiungibile --------------------- */
check(
  "Un dipendente puo' chiedere di vedere tutti",
  responsabileEffettivo(TUTTI, KLEA) === null,
  "nessuno resta chiuso fuori",
);
check(
  "E l'indirizzo lo dice esplicitamente",
  parametroPerTutti(KLEA) === TUTTI,
  "senza, la scelta tornerebbe indietro appena fatta",
);
check(
  "Per un responsabile «tutti» e' gia' il predefinito",
  parametroPerTutti(FRANCESCO) === null,
  "l'indirizzo resta pulito",
);

/* --- 3. Una persona precisa vale per chiunque ------------------------ */
check(
  "Un dipendente puo' guardare il lavoro di un collega",
  responsabileEffettivo("lorenzo", KLEA) === "lorenzo",
  "la board resta condivisa: si guarda, non si tocca",
);
check(
  "Anche un responsabile puo' isolarne uno",
  responsabileEffettivo("lorenzo", FRANCESCO) === "lorenzo",
);

/* --- 4. Lo stato dell'interruttore ----------------------------------- */
check(
  "Il dipendente parte da «solo le mie»",
  staVedendoTutti(null, KLEA) === false,
);
check(
  "Il responsabile parte da «tutto il team»",
  staVedendoTutti(null, FRANCESCO) === true,
);
check(
  "Con «all» tutti vedono tutti",
  staVedendoTutti(TUTTI, KLEA) === true &&
    staVedendoTutti(TUTTI, FRANCESCO) === true,
);

/* --- 5. Andata e ritorno: l'interruttore non si incastra ------------- */
{
  /* Da predefinito → tutti → di nuovo i propri, per un dipendente. */
  let param = null;
  check("Klea parte dai propri", responsabileEffettivo(param, KLEA) === "klea");
  param = parametroPerTutti(KLEA);
  check("Preme «tutto il team»", responsabileEffettivo(param, KLEA) === null);
  param = KLEA.id;
  check("Torna ai propri", responsabileEffettivo(param, KLEA) === "klea");
}

/* --- 6. Un valore sconosciuto non fa danni --------------------------- */
check(
  "Un parametro senza senso filtra su nulla, non apre tutto",
  responsabileEffettivo("id-inesistente", KLEA) === "id-inesistente",
  "meglio un elenco vuoto che il lavoro di tutti a sorpresa",
);
check(
  "La stringa vuota vale come «non chiesto»",
  responsabileEffettivo("", KLEA) === "klea",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
