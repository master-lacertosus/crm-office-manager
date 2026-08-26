/**
 * I filtri sopravvivono al cambio pagina.
 *
 * Il difetto: filtri e vista vivono nella querystring, ma i link della barra
 * laterale sono indirizzi nudi (`/tasks`). Filtrare per progetto, passare al
 * calendario e tornare indietro riportava l'elenco completo — e su una board
 * vera e' un gesto che si ripete venti volte al giorno.
 *
 *   node --import ./scripts/alias.mjs scripts/filtri-verify.mjs
 */
import { conFiltri, dimentica, filtriDi, ricorda } from "../lib/memoria-filtri.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/* --- 1. Si ricorda e si ritrova ------------------------------------- */
{
  dimentica();
  ricorda("/tasks", "owner=klea&project=p1");
  check(
    "Tornando ai task si ritrovano i filtri",
    conFiltri("/tasks") === "/tasks?owner=klea&project=p1",
    conFiltri("/tasks"),
  );
  check(
    "Una sezione mai visitata resta pulita",
    conFiltri("/calendar") === "/calendar",
    conFiltri("/calendar"),
  );
}

/* --- 2. Il pannello aperto non si ricorda --------------------------- */
{
  dimentica();
  ricorda("/tasks", "owner=klea&task=abc123&tv=peek&due=2026-01-01");
  const dove = conFiltri("/tasks");
  check(
    "Il task aperto non viene riaperto tornando indietro",
    dove === "/tasks?owner=klea",
    dove,
  );
  check(
    "Ne la vista del pannello, ne la data",
    !dove.includes("tv=") && !dove.includes("due="),
    dove,
  );
}

/* --- 3. Togliere i filtri li dimentica ------------------------------ */
{
  dimentica();
  ricorda("/tasks", "owner=klea");
  ricorda("/tasks", "");
  check(
    "Svuotando i filtri la sezione torna nuda",
    conFiltri("/tasks") === "/tasks",
    conFiltri("/tasks"),
  );
}

/* --- 4. Ogni sezione ha la sua memoria ------------------------------ */
{
  dimentica();
  ricorda("/tasks", "owner=klea");
  ricorda("/projects", "view=grid");
  check(
    "Le sezioni non si scambiano i filtri",
    conFiltri("/tasks") === "/tasks?owner=klea" &&
      conFiltri("/projects") === "/projects?view=grid",
    `${conFiltri("/tasks")} | ${conFiltri("/projects")}`,
  );
}

/* --- 5. Solo i parametri previsti ----------------------------------- */
{
  const filtrati = filtriDi("owner=k&project=p&view=v&q=testo&pippo=1&task=x");
  check(
    "Passano solo i parametri che descrivono cosa si guarda",
    !filtrati.includes("pippo") && !filtrati.includes("task"),
    filtrati,
  );
  check(
    "E ci sono tutti quelli previsti",
    ["owner=k", "project=p", "view=v", "q=testo"].every((p) =>
      filtrati.includes(p),
    ),
    filtrati,
  );
}

/* --- 6. Niente da ricordare, niente punto interrogativo ------------- */
{
  dimentica();
  ricorda("/tasks", "task=solo-il-pannello");
  check(
    "Un indirizzo senza filtri non prende un «?» a vuoto",
    conFiltri("/tasks") === "/tasks",
    conFiltri("/tasks"),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
