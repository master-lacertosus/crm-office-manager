/**
 * Verifica della regola dei permessi lato interfaccia.
 *
 * Non sostituisce la RLS — il confine vero è nel database (M9) — ma
 * garantisce che l'interfaccia mostri esattamente ciò che il database
 * permetterà: un pulsante che porta a un rifiuto è peggio di un pulsante
 * assente.
 *
 *   node scripts/permessi-verify.mjs
 */

import {
  eResponsabile,
  puoAssegnareAdAltri,
  puoGestireProgetti,
  puoLanciareTemplate,
  puoModificareTask,
} from "../lib/permessi.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

const francesco = { id: "francesco", role: "admin" };
const sara = { id: "sara", role: "admin" };
const klea = { id: "klea", role: "member" };
const lorenzo = { id: "lorenzo", role: "member" };

const taskDiKlea = { owner_id: "klea", created_by: "francesco" };
const taskDiLorenzo = { owner_id: "lorenzo", created_by: "lorenzo" };
const conCollaboratore = {
  owner_id: "lorenzo",
  created_by: "lorenzo",
  collaborators: ["klea"],
};

/* ---------- Responsabili ---------------------------------------------- */
check(
  "Francesco e Sara sono responsabili, Klea e Lorenzo no",
  eResponsabile(francesco) && eResponsabile(sara) &&
    !eResponsabile(klea) && !eResponsabile(lorenzo),
);
check(
  "I responsabili mettono le mani su qualunque task",
  puoModificareTask(taskDiKlea, francesco) &&
    puoModificareTask(taskDiLorenzo, sara),
);

/* ---------- Dipendenti ------------------------------------------------- */
check(
  "Un dipendente lavora il task di cui è responsabile",
  puoModificareTask(taskDiKlea, klea),
);
check(
  "Un dipendente NON tocca il task di un collega",
  !puoModificareTask(taskDiLorenzo, klea),
);
check(
  "Chi ha creato il task può ancora lavorarlo (anche se l'ha assegnato ad altri)",
  puoModificareTask(taskDiKlea, { id: "francesco", role: "member" }),
);
check(
  "Un collaboratore esplicito può lavorare il task",
  puoModificareTask(conCollaboratore, klea),
);
check(
  "Chi non è né responsabile né creatore né collaboratore resta fuori",
  !puoModificareTask(conCollaboratore, { id: "riccardo", role: "member" }),
);

/* ---------- Governo ---------------------------------------------------- */
check(
  "Assegnare lavoro ad altri è dei responsabili",
  puoAssegnareAdAltri(francesco) && !puoAssegnareAdAltri(klea),
);
check(
  "I progetti li gestiscono i responsabili",
  puoGestireProgetti(sara) && !puoGestireProgetti(lorenzo),
);
check(
  "Lanciare un template è dei responsabili",
  puoLanciareTemplate(francesco) && !puoLanciareTemplate(klea),
);

/* ---------- Estremi ---------------------------------------------------- */
check(
  "Un ruolo sconosciuto non vale come responsabile",
  !eResponsabile({ id: "x", role: "viewer" }),
);
check(
  "Nessun collaboratore: la lista assente non rompe la regola",
  !puoModificareTask({ owner_id: "a", created_by: "b" }, klea),
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
