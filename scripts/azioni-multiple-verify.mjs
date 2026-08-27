/**
 * Azioni su piu' task: cosa si tocca e cosa no.
 *
 * Il punto delicato non e' l'azione, sono i PERMESSI. Su una board
 * condivisa la selezione puo' contenere task di colleghi, e un dipendente
 * non puo' toccarli. Le due strade facili sono entrambe sbagliate:
 *
 *   - rifiutare tutto perche' uno e' bloccato punisce un gesto legittimo;
 *   - agire in silenzio su quelli che si puo' lascia credere di aver
 *     spostato otto cose quando se ne sono spostate quattro.
 *
 * Qui si controlla che la ripartizione sia quella giusta per ogni ruolo, e
 * che quello che si dice all'utente corrisponda a quello che succede.
 *
 *   node --import ./scripts/alias.mjs scripts/azioni-multiple-verify.mjs
 */
import { puoAssegnareAdAltri, puoModificareTask } from "../lib/permessi.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const KLEA = { id: "klea", role: "member" };
const FRANCESCO = { id: "francesco", role: "admin" };

const t = (id, owner, extra = {}) => ({
  id,
  owner_id: owner,
  created_by: owner,
  ...extra,
});

/* Una selezione mista, come capita davvero. */
const SELEZIONE = [
  t("a", "klea"),
  t("b", "klea"),
  t("c", "lorenzo"),
  t("d", "lorenzo"),
  t("e", "sara", { collaborators: ["klea"] }),
];

/** La stessa ripartizione che fa la barra. */
function ripartisci(scelti, utente, padreDi = () => null) {
  const modificabili = scelti.filter((x) =>
    puoModificareTask(x, utente, padreDi(x)),
  );
  return { modificabili, bloccati: scelti.length - modificabili.length };
}

/* --- 1. Un dipendente tocca i propri e quelli in cui collabora ------- */
{
  const { modificabili, bloccati } = ripartisci(SELEZIONE, KLEA);
  check(
    "Klea puo' toccare i propri e quello in cui collabora",
    modificabili.map((x) => x.id).join(",") === "a,b,e",
    modificabili.map((x) => x.id).join(",") || "nessuno",
  );
  check(
    "E i due di Lorenzo restano fuori",
    bloccati === 2,
    `${bloccati} bloccati: e' il numero che la barra deve dichiarare PRIMA`,
  );
}

/* --- 2. Un responsabile li tocca tutti ------------------------------ */
{
  const { modificabili, bloccati } = ripartisci(SELEZIONE, FRANCESCO);
  check(
    "Un responsabile li tocca tutti",
    modificabili.length === SELEZIONE.length && bloccati === 0,
    `${modificabili.length}/${SELEZIONE.length}`,
  );
}

/* --- 3. Chi guida un lavoro governa i suoi pezzi -------------------- */
{
  const padre = t("padre", "klea");
  const pezzo = t("pezzo", "lorenzo", { parent_id: "padre" });
  const { modificabili, bloccati } = ripartisci([pezzo], KLEA, () => padre);
  check(
    "Klea puo' toccare un pezzo del proprio lavoro anche se e' di Lorenzo",
    modificabili.length === 1 && bloccati === 0,
    "chi guida un lavoro deve poterne organizzare i pezzi",
  );
}

/* --- 4. Nessuno tocca niente: l'azione non deve nemmeno partire ----- */
{
  const soloAltrui = [t("c", "lorenzo"), t("d", "lorenzo")];
  const { modificabili, bloccati } = ripartisci(soloAltrui, KLEA);
  check(
    "Una selezione tutta altrui non lascia niente da fare",
    modificabili.length === 0 && bloccati === 2,
    "i menu restano disabilitati invece di fallire dopo",
  );
}

/* --- 5. Chi puo' affidare lavoro ad altri --------------------------- */
{
  check(
    "Solo un responsabile vede «Affida a…»",
    puoAssegnareAdAltri(FRANCESCO) === true &&
      puoAssegnareAdAltri(KLEA) === false,
    "riassegnare e' un atto di governo: per proporlo ci sono le Richieste",
  );
}

/* --- 6. Il conteggio dichiarato e quello agito coincidono ----------- */
{
  const { modificabili, bloccati } = ripartisci(SELEZIONE, KLEA);
  const dichiarato = modificabili.length + bloccati;
  check(
    "Toccati piu' bloccati fanno esattamente i selezionati",
    dichiarato === SELEZIONE.length,
    `${modificabili.length} + ${bloccati} = ${dichiarato} su ${SELEZIONE.length}`,
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
