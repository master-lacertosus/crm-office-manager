/**
 * Costruisce supabase/AGGIORNA-DATABASE.sql: un file solo, da incollare una
 * volta sola, al posto di quattro da applicare nell'ordine giusto.
 *
 * Perché non basta incollare i quattro file di seguito: sono scritti per
 * essere applicati una volta, e riapplicandoli si fermano al primo oggetto
 * che esiste già («trigger ... already exists»). Chi non sa dove si era
 * fermato non ha modo di ripartire. Qui ogni creazione viene preceduta dal
 * suo «togli se c'è», così il file si può ridare quante volte si vuole e
 * l'esito è sempre lo stesso.
 *
 *   node scripts/genera-aggiornamento-db.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRAZIONI = [
  ["M7", "20260824120000_m7_ricorrenze.sql", "Ricorrenze: da tre cadenze a otto"],
  ["M8", "20260824140000_m8_realtime_workspace.sql", "La board si aggiorna da sola"],
  ["M9", "20260825120000_m9_permessi.sql", "Responsabili e dipendenti: il confine"],
  ["M10", "20260825140000_m10_sotto_task.sql", "Sotto-task: un lavoro, più mani"],
];

const DIR = process.argv[2] ?? "supabase/migrations";

/* ------------------------------------------------------------------ */
/* Commenti in ASCII                                                   */
/*                                                                     */
/* Questo file lo si incolla dentro un browser, e un carattere fuori   */
/* dall'ASCII e' la prima cosa che si rovina per strada: basta un      */
/* passaggio di troppo fra editor, appunti e casella di testo perche'  */
/* arrivi al server qualcosa che non e' piu' quello che c'era scritto  */
/* — e a quel punto PostgreSQL si ferma con «syntax error», a meta'    */
/* lavoro. Le migrazioni sorgenti restano in italiano vero: e' solo    */
/* questo artefatto, quello che fa il viaggio, a viaggiare leggero.    */
/*                                                                     */
/* Le stringhe fra apici non si toccano: sono i messaggi che il team   */
/* legge quando qualcosa va storto, e li' l'italiano serve. Un         */
/* carattere rovinato dentro una stringa fa al massimo un glifo        */
/* sbagliato in un messaggio, non un errore di sintassi.               */
/* ------------------------------------------------------------------ */
const TRASLITTERA = {
  à: "a'", è: "e'", é: "e'", ì: "i'", ò: "o'", ù: "u'",
  À: "A'", È: "E'", É: "E'", Ì: "I'", Ò: "O'", Ù: "U'",
  "«": '"', "»": '"', "‹": "<", "›": ">",
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "—": "--", "–": "-", "…": "...", "·": "-", "•": "-",
  "→": "->", "←": "<-", "↓": "v", "↑": "^", "★": "*", "☆": "*",
};

function commentiInAscii(sql) {
  const righe = sql.split("\n");
  let cambiate = 0;
  const fatte = righe.map((riga) => {
    const taglio = riga.indexOf("--");
    // Solo i commenti che occupano tutta la riga: un «--» dopo del codice
    // potrebbe stare dentro una stringa, e li' non si tocca niente.
    if (taglio !== 0 && riga.slice(0, taglio).trim() !== "") return riga;
    if (taglio < 0) return riga;
    let fuori = "";
    for (const ch of riga) {
      fuori += ch.codePointAt(0) > 127 ? (TRASLITTERA[ch] ?? "?") : ch;
    }
    if (fuori !== riga) cambiate++;
    return fuori;
  });
  return { sql: fatte.join("\n"), cambiate };
}

/* --- Le tre creazioni che non tollerano di essere ridate ------------- */
function rendiRipetibile(sql, nome) {
  let n = 0;

  // 1. Le funzioni: «or replace» le rende riscrivibili.
  sql = sql.replace(/^create function /gm, () => {
    n++;
    return "create or replace function ";
  });

  // 2. I trigger: non esiste «or replace», si toglie e si rifà.
  sql = sql.replace(
    /^create trigger (\w+)\n(\s+)(before|after|instead of)([\s\S]*?)on (public\.\w+)/gm,
    (intero, trigger, spazi, quando, mezzo, tabella) => {
      n++;
      return `drop trigger if exists ${trigger} on ${tabella};\ncreate trigger ${trigger}\n${spazi}${quando}${mezzo}on ${tabella}`;
    },
  );

  // 3. Le policy: stessa storia. Il file toglie già quelle vecchie, con il
  //    nome vecchio; qui si toglie anche quella nuova.
  sql = sql.replace(
    /^create policy (\w+)\n(\s+)on (public\.\w+)/gm,
    (intero, policy, spazi, tabella) => {
      n++;
      return `drop policy if exists ${policy} on ${tabella};\ncreate policy ${policy}\n${spazi}on ${tabella}`;
    },
  );

  console.log(`  ${nome}: ${n} creazioni rese ripetibili`);
  return sql;
}

const intestazione = `-- =============================================================================
-- Lacertosus Office OS — AGGIORNAMENTO DEL DATABASE
--
-- COSA FARE, in breve:
--   1. Apri Supabase, voce «SQL Editor» nel menu a sinistra.
--   2. Incolla tutto questo file.
--   3. Premi «Run».
--
-- È tutto. Non c'è niente da scommentare, niente da modificare, niente da
-- decidere. E se lo esegui due volte non succede niente di male: il file
-- rifà soltanto ciò che manca.
--
-- Alla fine leggerai un elenco di righe «NOTICE»: sono il resoconto, non
-- errori. Un errore, se capita, si presenta in rosso e ferma tutto — in quel
-- caso non è stato applicato niente, e il messaggio dice cosa non è andato.
--
-- COSA PORTA (le quattro cose ferme in attesa di questo file):
${MIGRAZIONI.map(([sigla, , titolo]) => `--   ${sigla.padEnd(4)}${titolo}`).join("\n")}
--
-- Questo file NON tocca i dati esistenti: non cancella e non riscrive righe.
-- Aggiunge regole, permessi e una colonna.
-- =============================================================================

begin;
`;

const pezzi = [intestazione];

for (const [sigla, file, titolo] of MIGRAZIONI) {
  const sql = readFileSync(join(DIR, file), "utf8");
  pezzi.push(
    "",
    "-- #############################################################################",
    `-- ${sigla} — ${titolo}`,
    `-- (equivale a supabase/migrations/${file})`,
    "-- #############################################################################",
    "",
    rendiRipetibile(sql, sigla).trimEnd(),
  );
}

pezzi.push(
  "",
  "commit;",
  "",
  "-- =============================================================================",
  "-- Fatto. Da qui in poi il CRM può usare le ricorrenze fitte, gli aggiornamenti",
  "-- dal vivo, il confine fra responsabili e dipendenti e i sotto-task.",
  "-- =============================================================================",
  "",
);

const { sql: finale, cambiate } = commentiInAscii(pezzi.join("\n"));
console.log(`  commenti resi ASCII: ${cambiate} righe`);

/* Controprova prima di scrivere: fuori dalle stringhe non deve restare
   niente sopra il codice 127. Se ne resta, il file non parte — meglio
   accorgersene qui che dentro il SQL Editor. */
const rimasti = finale
  .split("\n")
  .map((r, n) => [n + 1, r])
  .filter(([, r]) => r.trimStart().startsWith("--") && [...r].some((c) => c.codePointAt(0) > 127));
if (rimasti.length > 0) {
  console.error(`\nNon-ASCII rimasto in ${rimasti.length} commenti, il primo alla riga ${rimasti[0][0]}:`);
  console.error(`  ${rimasti[0][1]}`);
  console.error("Aggiungere il carattere alla tabella TRASLITTERA.");
  process.exit(1);
}

const uscita = "supabase/AGGIORNA-DATABASE.sql";
writeFileSync(uscita, finale);
console.log(`\n${uscita} scritto (${finale.split("\n").length} righe)`);
