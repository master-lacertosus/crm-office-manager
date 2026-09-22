/**
 * I sondaggi al team: il voto resta anonimo, e uno per volta resta uno.
 *
 * Due promesse, e tutte e due sono il genere di cosa che si rompe in
 * silenzio — cioe' continuando a sembrare giusta.
 *
 *   1. L'ANONIMATO. «Si vede chi ha votato, non cosa» non e' una frase
 *      dell'interfaccia: e' il fatto che la scheda di un altro non arrivi
 *      proprio al browser. La RLS di PostgreSQL e' ROW level e non sa
 *      nascondere una colonna, quindi l'urna e il registro sono due tabelle
 *      diverse. Il giorno che qualcuno le ricuce «per comodita'» -- una
 *      join, una colonna in piu' nella select, una policy piu' larga -- la
 *      promessa diventa falsa senza che nulla smetta di funzionare.
 *
 *   2. IL BLOCCO. Un solo sondaggio aperto per volta. Se vivesse in un `if`
 *      di React, due schede o due persone nello stesso secondo lo
 *      scavalcherebbero. Sta nel database, e la frase leggibile arriva
 *      PRIMA che l'indice unico apra bocca -- perche' lib/riprova.ts tratta
 *      il codice 23505 come «gia' fatto» e lo ingoierebbe.
 *
 *   3. E il difetto di casa: non si annuncia cio' che non e' stato salvato.
 *
 *   node --import ./scripts/alias.mjs scripts/sondaggi-verify.mjs
 */
import { readFileSync } from "node:fs";

import {
  chiManca,
  daInterrompere,
  scadenzaMinima,
  scadenzaPredefinita,
  eAperto,
  hoVotato,
  inTesta,
  percentuale,
  perche,
  sondaggioAperto,
  tempoRimasto,
} from "@/lib/sondaggi.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`,
  );
}
const leggi = (p) => readFileSync(p, "utf8");

/** Il codice senza i commenti. Serve ai controlli che VIETANO qualcosa: qui
 *  i commenti spiegano spesso perche' una cosa non si fa, e nominarla li'
 *  dentro non e' farla. */
const senzaCommenti = (p) =>
  leggi(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

const m19 = leggi("supabase/migrations/20260921200000_m19_sondaggi.sql");
const m21 = leggi(
  "supabase/migrations/20260922160000_m21_sondaggi_firmati_e_risultato.sql",
);
const queries = leggi("lib/supabase/queries.ts");
const store = leggi("lib/store.tsx");
const popup = leggi("components/sondaggi/popup-sondaggio.tsx");
const pagina = leggi("components/sondaggi/sondaggi-content.tsx");
const riga = leggi("components/sondaggi/riga-opzione.tsx");

/* ------------------------------------------------------------------ */
console.log("\n# L'urna e il registro sono due cose diverse\n");
/* ------------------------------------------------------------------ */

check(
  "L'urna e' una tabella, il registro un'altra",
  /create table if not exists public\.sondaggio_schede/.test(m19) &&
    /create table if not exists public\.sondaggio_firme/.test(m19),
  "la RLS e' row level e non sa nascondere una colonna: e' l'unico modo onesto di avere «chi ha votato» senza «cosa ha votato»",
);
check(
  "Della propria scheda si vede solo la propria riga",
  /sondaggio_schede_select_propria[\s\S]{0,300}using \(profile_id = \(select auth\.uid\(\)\)\)/.test(
    m19,
  ),
);
check(
  "Nemmeno un admin apre l'urna",
  !/sondaggio_schede_select[\s\S]{0,300}is_admin\(\)/.test(m19),
  "se il titolare puo' vedere come hai votato, non hai votato: hai risposto",
);
check(
  "Il registro invece lo vedono tutti",
  /sondaggio_firme_select_membri[\s\S]{0,260}is_active_member\(\)/.test(m19),
  "serve a sapere chi manca, che con sei persone e' la domanda vera",
);
/*
 * DA M21 QUESTO CONTROLLO DICE UNA COSA DIVERSA, e vale la pena scriverlo.
 *
 * Prima pretendeva che la lettura non chiedesse MAI chi avesse messo quella
 * scheda: l'anonimato era una proprieta' della tabella. Adesso e' una
 * proprieta' del SONDAGGIO -- chi lancia decide -- quindi la lettura chiede
 * sempre il proprietario, e a non consegnarlo e' la policy.
 *
 * Il che sposta il peso: la promessa non vive piu' nella query ma nella riga
 * di SQL qui sotto. Se qualcuno la allarga, l'anonimato dichiarato
 * nell'interfaccia diventa una bugia e tutto continua a funzionare.
 */
check(
  "A decidere se l'urna si apre e' il SONDAGGIO, non la tabella",
  /sondaggio_e_palese\(sondaggio_id\)/.test(m21) &&
    /profile_id = \(select auth\.uid\(\)\)\s*\n\s*or \(/.test(m21),
  "la propria scheda si vede sempre; le altre solo dove e' stato dichiarato",
);
check(
  "E la funzione che lo decide e' security definer e stable",
  /create or replace function public\.sondaggio_e_palese[\s\S]{0,140}stable[\s\S]{0,60}security definer[\s\S]{0,60}set search_path = ''/.test(
    m21,
  ),
  "una policy che interroga un'altra tabella con la RLS accesa e' il modo in cui su questo repo e' gia' nata una ricorsione (M11)",
);
check(
  "Il valore di serie e' l'anonimato",
  /add column if not exists palese boolean not null default false/.test(m21) &&
    /React\.useState\(false\)/.test(pagina),
  "un'impostazione che protegge le persone non si mette dietro una spunta da ricordarsi",
);
check(
  "Chi vota sa PRIMA se la sua risposta sara' firmata",
  /sondaggio\.palese/.test(popup) && /Risposte firmate/.test(popup),
  "scoprirlo dopo aver votato sarebbe un inganno, non un dettaglio",
);
check(
  "I nomi si leggono solo dove il sondaggio e' firmato",
  /if \(!s\.palese\) return \[\];/.test(leggi("lib/sondaggi.ts")),
  "e comunque in un sondaggio anonimo le righe degli altri non arrivano: questo e' solo il secondo lucchetto",
);

check(
  "E il tipo di dominio non ha un posto dove metterla",
  !/schede\s*:/.test(leggi("lib/sondaggi.ts")) &&
    /miaScelta: string \| null/.test(leggi("lib/sondaggi.ts")),
  "arriva al massimo la PROPRIA scelta: se comparisse un elenco di schede, l'anonimato sarebbe gia' finito",
);
check(
  "L'urna non entra in Realtime",
  !/sondaggio_schede/.test(senzaCommenti("lib/supabase/realtime.ts")) &&
    !/'sondaggio_schede'/.test(m19.split("12. Realtime")[1] ?? ""),
  "non porterebbe niente a nessuno, ma lasciarla fuori dice a chi legge che li dentro non si entra",
);

/* ------------------------------------------------------------------ */
console.log("\n# Uno per volta, e con la porta aperta\n");
/* ------------------------------------------------------------------ */

check(
  "La funzione che le policy chiamano nasce PRIMA delle policy",
  m19.indexOf("create or replace function public.sondaggio_e_aperto") <
    m19.indexOf("create policy sondaggio_schede_insert_propria"),
  "PostgreSQL risolve il nome nel momento in cui crea la policy: definita dopo, la migrazione si ferma a meta' con «function public.sondaggio_e_aperto(uuid) does not exist» -- ed e' successo davvero, incollando M19 la prima volta",
);

check(
  "Il blocco sta nel database, non in React",
  /create unique index if not exists sondaggi_uno_attivo_idx[\s\S]{0,120}where chiuso_at is null/.test(
    m19,
  ),
  "due schede aperte o due persone nello stesso secondo scavalcherebbero un if",
);
check(
  "Ma la frase leggibile arriva PRIMA dell'indice",
  /C''e'' gia'' un sondaggio aperto, lanciato da %/.test(m19),
  "l'indice direbbe «duplicate key», e lib/riprova.ts tratta quel codice come «gia' fatto»: il blocco sarebbe invisibile",
);
check(
  "E quella frase arriva all'utente com'e'",
  !/Sondaggio non lanciato\.\"\s*\)\s*;\s*\n\s*return null;\s*\n\s*\}\s*\n\s*\}/.test(
    store.replace(/\s+/g, " "),
  ) && /messaggioErrore\(e, "Sondaggio non lanciato\."\)/.test(store),
  "messaggioErrore conserva message, details, hint e codice: riformularla toglierebbe l'unica informazione utile",
);
check(
  "Chi lancia toglie di mezzo per primo cio' che e' scaduto",
  /perform public\.chiudi_sondaggi_scaduti\(\);[\s\S]{0,400}select \* into attivo/.test(
    m19,
  ),
  "senza, un sondaggio dimenticato bloccherebbe tutti fino al passaggio successivo del lavoro pianificato -- o per sempre, se pg_cron non fosse disponibile",
);
check(
  "Tre strade per chiudere, e sono tre",
  /s\.autore_id = \(select auth\.uid\(\)\)[\s\S]{0,120}is_admin\(\)[\s\S]{0,80}s\.scade_at <= now\(\)/.test(
    m19,
  ),
  "chi l'ha lanciato, un responsabile, o chiunque se e' scaduto: l'ultima e' la valvola che impedisce al blocco di diventare una trappola",
);
check(
  "E l'interfaccia offre esattamente quelle tre",
  /sondaggio\.autore_id === currentUser\.id[\s\S]{0,140}eResponsabile\(currentUser\)[\s\S]{0,40}scaduto/.test(
    pagina,
  ),
  "offrirne di meno nasconde una via d'uscita, offrirne di piu' promette un gesto che verra' rifiutato",
);
check(
  "Si chiude da solo quando ha votato l'ultimo",
  /firme >= quanti/.test(m19),
  "tenerlo aperto dopo che hanno risposto tutti bloccherebbe il prossimo per niente",
);
check(
  "E c'e' un lavoro pianificato per gli scaduti",
  /cron\.schedule\(\s*'sondaggi-scaduti'/.test(m19.replace(/\s+/g, " ")),
);
check(
  "Il modulo resta scrivibile anche mentre un altro e' in corso",
  /bloccatoDa/.test(pagina) && /Ne resta uno alla volta/.test(pagina),
  "un blocco che nomina da chi e da quando dipende e' un'indicazione, non un divieto anonimo",
);

/* ------------------------------------------------------------------ */
console.log("\n# Non si annuncia cio' che non e' stato salvato\n");
/* ------------------------------------------------------------------ */

check(
  "Le tre scritture aspettano l'esito",
  /async lanciaSondaggio[\s\S]{0,2400}setSyncError[\s\S]{0,60}return null;/.test(
    store,
  ) &&
    /async votaSondaggio[\s\S]{0,2200}setSyncError[\s\S]{0,60}return false;/.test(
      store,
    ) &&
    /async chiudiSondaggio[\s\S]{0,800}setSyncError[\s\S]{0,60}return false;/.test(
      store,
    ),
);
check(
  "Nessuna passa da scriviCon",
  !/scriviCon\([\s\S]{0,80}Sondaggi?o/i.test(senzaCommenti("lib/store.tsx")),
  "scriviCon e' fire-and-forget: non torna un esito, e il toast partirebbe comunque. E' il difetto del 21 settembre",
);
check(
  "Il toast del lancio arriva dopo il «se non e' andata, fermati»",
  /if \(!id\) return;[\s\S]{0,500}onFatto\(id\)/.test(pagina),
);
check(
  "E il popup non annuncia prima di sapere",
  /if \(!fatto\) return;[\s\S]{0,80}setVotato\(true\)/.test(popup),
);
check(
  "Chi lancia rilegge subito, senza aspettare un annuncio",
  /const aggiornati = await fetchSondaggi\(/.test(store),
  "il battito di sicurezza dello store riparte SOLO se Realtime e spento: con il canale connesso e le tabelle fuori dalla publication non rilegge mai nessuno, e chi lanciava non vedeva il proprio sondaggio",
);
check(
  "Il popup non si chiude nel momento in cui voti",
  /idBloccato/.test(popup) && /setIdBloccato\(sondaggio\.id\)/.test(popup),
  "daInterrompere() smette di restituirlo appena la firma entra nel registro, cioe nello stesso istante del voto: la scheda spariva mentre le barre stavano ancora crescendo",
);
check(
  "Dopo il voto si vedono le percentuali, non solo i conteggi",
  /\{percento\}%/.test(riga),
  "prima la percentuale viveva solo nel testo per i lettori di schermo, cioe da nessuna parte per tutti gli altri",
);
check(
  "I sondaggi NON passano da useSincronizza",
  !/useSincronizza\(\s*sondaggi/.test(store.replace(/\s+/g, " ")),
  "confronta gli id: vedrebbe righe nuove e sparite, mai un voto ne' il passaggio da aperto a chiuso -- e sarebbe un secondo scrittore su righe che il database governa da solo",
);

/* ------------------------------------------------------------------ */
console.log("\n# Il popup interrompe una volta sola\n");
/* ------------------------------------------------------------------ */

check(
  "Mai sopra un altro dialogo",
  /document\.querySelector\('\[role="dialog"\]'\)/.test(popup),
  "a z-95 finirebbe dietro quattro dialoghi che stanno a z-100, con aria-modal e una trappola del fuoco, dentro una scheda che non si vede",
);
check(
  "Mai durante il caricamento o senza identita'",
  /!loading && Boolean\(currentUser\.id\)/.test(popup),
  "currentUser durante il caricamento e' una sentinella con id vuoto",
);
check(
  "Esc mette via, e in fase di cattura",
  /stopImmediatePropagation\(\)/.test(popup) &&
    /addEventListener\("keydown", suTasto, true\)/.test(popup),
  "una ventina di dialoghi ascoltano tutti su window in bolla: un solo Esc ne chiuderebbe due",
);
check(
  "Il fuoco resta dentro e poi torna dov'era",
  /useTrappolaFuoco\(scheda, aperto\)/.test(popup) &&
    /prima\?\.focus\?\.\(\)/.test(leggi("lib/fuoco.ts")),
);
check(
  "Lo scorrimento della pagina NON si blocca",
  !/document\.body\.style\.overflow/.test(popup),
  "il blocco del prodotto non e' a conteggio: chiudendosi sopra un pannello aperto sbloccherebbe la pagina sotto di lui",
);
check(
  "C'e' il ramo «chiuso mentre lo guardi»",
  /soloLettura/.test(popup) && /eAperto\(sondaggio, adesso\)/.test(popup),
  "senza, un voto in ritardo verrebbe respinto dalla policy e comparirebbe come «Risposta non registrata»: un guasto di rete travestito da esito normale",
);
check(
  "Il velo usa il token, non un inchiostro",
  /bg-scrim/.test(popup) &&
    !/bg-ink\//.test(senzaCommenti("components/sondaggi/popup-sondaggio.tsx")),
  "bg-ink/20 in tema scuro sarebbe BIANCO, perche' l'inchiostro di notte e' quasi bianco",
);

/* ------------------------------------------------------------------ */
console.log("\n# La riga che diventa la sua barra\n");
/* ------------------------------------------------------------------ */

check(
  "Una riga sola per popup, pagina e archivio",
  /RigaOpzione/.test(popup) && /RigaOpzione/.test(pagina),
  "tre copie divergerebbero al primo ritocco: su questo repo e' gia' successo con l'ordinamento e con i filtri",
);
check(
  "La barra si muove con transform, mai con la larghezza",
  /scaleX/.test(riga) && !/animate=\{\{ width/.test(riga),
);
check(
  "E non usa bg-selected",
  !/bg-selected/.test(senzaCommenti("components/sondaggi/riga-opzione.tsx")),
  "in tema chiaro e' brand-50 su una chip quasi bianca: circa 1,03:1, una barra che cresce e non si vede",
);
check(
  "Il movimento ridotto vale anche per l'interruttore interno",
  /useReducedMotion\(\) \|\| prefs\.reduceMotion/.test(riga) &&
    /useReducedMotion\(\) \|\| prefs\.reduceMotion/.test(popup),
  "useReducedMotion() legge solo la media query di sistema: chi l'ha acceso in Impostazioni vedrebbe le barre correre lo stesso",
);
check(
  "Dopo il voto la riga non finge di essere ancora un modulo",
  /if \(votato \|\| !onScegli\)/.test(riga) && /<li className=\{classi\}>/.test(riga),
  "dentro un fieldset disabilitato i risultati si leggono come una fila di scelte non disponibili",
);
check(
  "Il colore non e' mai l'unico canale",
  /in testa/.test(riga) && /sr-only/.test(riga),
);

/* ------------------------------------------------------------------ */
console.log("\n# L'aritmetica\n");
/* ------------------------------------------------------------------ */

const ora = new Date("2026-09-22T10:00:00");
const base = {
  id: "s1",
  autore_id: "marco",
  domanda: "Che giorno?",
  aperto_at: "2026-09-22T09:00:00",
  scade_at: "2026-09-22T13:00:00",
  chiuso_at: null,
  chiuso_da: null,
  aventi_diritto: 6,
  voti_totali: 4,
  opzioni: [
    { id: "a", testo: "Martedi", posizione: 1, voti: 2 },
    { id: "b", testo: "Giovedi", posizione: 2, voti: 2 },
  ],
  firme: ["marco", "giulia", "lorenzo", "sara"],
  miaScelta: null,
};

check("Un sondaggio nei termini e' aperto", eAperto(base, ora) === true);
check(
  "Uno scaduto no, anche se nessuno l'ha ancora chiuso",
  eAperto({ ...base, scade_at: "2026-09-22T09:30:00" }, ora) === false,
  "fra la scadenza e il passaggio del lavoro pianificato passano fino a cinque minuti",
);
check(
  "Uno chiuso a mano nemmeno",
  eAperto({ ...base, chiuso_at: "2026-09-22T09:40:00" }, ora) === false,
);
check("Si trova quello aperto", sondaggioAperto([base], ora)?.id === "s1");
check("Chi ha firmato ha votato", hoVotato(base, "giulia") === true);
check("Chi non ha firmato no", hoVotato(base, "riccardo") === false);
check("Le percentuali tornano", percentuale(base.opzioni[0], base) === 50);
check(
  "Zero voti non fa NaN",
  percentuale({ id: "x", testo: "", posizione: 1, voti: 0 }, {
    ...base,
    voti_totali: 0,
  }) === 0,
);

check(
  "Un pareggio resta un pareggio",
  inTesta(base).length === 2,
  "fra sei persone il 2-2-2 e' la norma: incoronare la prima delle tre sarebbe una bugia decisa dall'ordine di inserimento",
);
check(
  "E senza voti non c'e' nessuno in testa",
  inTesta({ ...base, opzioni: base.opzioni.map((o) => ({ ...o, voti: 0 })) })
    .length === 0,
);

const ufficio = [
  { id: "marco", full_name: "Marco" },
  { id: "giulia", full_name: "Giulia" },
  { id: "riccardo", full_name: "Riccardo" },
  { id: "spento", full_name: "Ex", is_active: false },
];
check(
  "Chi manca sono le persone attive che non hanno firmato",
  chiManca(base, ufficio).map((p) => p.id).join(",") === "riccardo",
  "chi non lavora piu' qui non «manca»: e' uscito",
);

check("Il tempo che resta si legge", tempoRimasto(base, ora) === "3h");
check(
  "Scaduto lo dice",
  tempoRimasto({ ...base, scade_at: "2026-09-22T09:00:00" }, ora) === "scaduto",
);
check(
  "E i giorni si dicono in giorni",
  tempoRimasto({ ...base, scade_at: "2026-09-25T10:00:00" }, ora) === "3 giorni",
);

/* ------------------------------------------------------------------ */
console.log("\n# Chi viene interrotto, e chi no\n");
/* ------------------------------------------------------------------ */

check(
  "Chi non ha votato viene interrotto",
  daInterrompere([base], "riccardo", [], ora)?.id === "s1",
);
check(
  "Chi ha gia' votato no",
  daInterrompere([base], "giulia", [], ora) === null,
  "il popup non gli chiede niente e sarebbe solo un ostacolo",
);
check(
  "Chi l'ha messo via nemmeno",
  daInterrompere([base], "riccardo", ["s1"], ora) === null,
);
check(
  "Ma mettere via uno non mette via il prossimo",
  daInterrompere([{ ...base, id: "s2" }], "riccardo", ["s1"], ora)?.id === "s2",
  "si tengono gli id e non un «l'ho visto»: chi scarta quello di oggi deve vedere quello di domani",
);
check(
  "Senza identita' non si interrompe nessuno",
  daInterrompere([base], "", [], ora) === null,
);
check(
  "E un sondaggio chiuso non interrompe",
  daInterrompere([{ ...base, chiuso_at: "2026-09-22T09:40:00" }], "riccardo", [], ora) ===
    null,
);

/* ------------------------------------------------------------------ */
console.log("\n# Il modulo dice di no prima di far scrivere\n");
/* ------------------------------------------------------------------ */

const fraDueOre = new Date(ora.getTime() + 2 * 60 * 60_000).toISOString();
check("Serve la domanda", perche("", ["a", "b"], fraDueOre, ora) === "Scrivi la domanda");
check(
  "Servono due risposte",
  perche("Che giorno?", ["a", ""], fraDueOre, ora) === "Servono almeno due risposte",
);
check(
  "Due risposte uguali non sono due risposte",
  perche("Che giorno?", ["Martedi", " martedi "], fraDueOre, ora) ===
    "Ci sono due risposte uguali",
);
check(
  "E se e' tutto a posto, tace",
  perche("Che giorno?", ["a", "b"], fraDueOre, ora) === null,
);
check(
  "Una scadenza fra cinque minuti non si accetta",
  perche("Che giorno?", ["a", "b"], new Date(ora.getTime() + 5 * 60_000).toISOString(), ora) !== null,
  "il database pretende un quarto d'ora: prima, nessuno fa in tempo a rispondere",
);
check(
  "E nemmeno fra un mese",
  perche("Che giorno?", ["a", "b"], new Date(ora.getTime() + 30 * 24 * 3600_000).toISOString(), ora) !== null,
);
check(
  "La scadenza proposta e' domani a fine giornata",
  scadenzaPredefinita(ora).endsWith("T17:30") &&
    scadenzaPredefinita(ora).startsWith("2026-09-23"),
  scadenzaPredefinita(ora) + " -- le 17:30 sono il momento in cui questo ufficio smette",
);
check(
  "E il primo momento accettabile e' fra un quarto d'ora",
  scadenzaMinima(ora) === "2026-09-22T10:15",
  scadenzaMinima(ora),
);

/* ------------------------------------------------------------------ */
console.log("\n# Il giro completo\n");
/* ------------------------------------------------------------------ */

check(
  "Le tre tabelle pubbliche entrano in Realtime, lato client e lato database",
  /"sondaggi",\s*"sondaggio_opzioni",\s*"sondaggio_firme",/.test(
    leggi("lib/supabase/realtime.ts").replace(/\s+/g, " "),
  ) && /'sondaggi',\s*'sondaggio_opzioni',\s*'sondaggio_firme'/.test(m19),
  "con la sola riga lato client il canale si apre e non arriva mai niente, e il battito da sessanta secondi maschera il buco facendo sembrare il sondaggio lento invece che rotto",
);
check(
  "La campanella conosce la parola nuova",
  /'sondaggio'/.test(m19) && /"sondaggio"/.test(leggi("lib/types.ts")),
);
check(
  "Ma il browser non puo' fabbricare quell'avviso",
  /Exclude<NotificationKind, "assegnazione" \| "sondaggio">/.test(store),
  "lo scrive lancia_sondaggio() per conto di chi lancia: rimandarlo indietro creerebbe un doppione",
);
check(
  "La pagina e' raggiungibile",
  /href: "\/sondaggi"/.test(leggi("components/shell/sidebar.tsx")),
);
check(
  "Il popup e' montato dove puo' comparire ovunque",
  /<PopupSondaggio \/>/.test(leggi("components/shell/ambient-overlays.tsx")),
  "una domanda al team non aspetta che tu apra la pagina giusta",
);
check(
  "I sondaggi NON diventano un blocco della dashboard",
  !/sondaggi: \{ title:/.test(leggi("lib/dashboard-layout.ts")) &&
    /const LAYOUT_VERSION = 1;/.test(leggi("lib/dashboard-layout.ts")),
  "alzare la versione azzererebbe il layout personalizzato di tutti e sei",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
