/**
 * Le ore che si contano, e il tempo che fa.
 *
 * L'aritmetica delle ore e' il punto in cui questa funzionalita' vive o
 * muore. Progettandola sono emersi tre modi indipendenti di sbagliarla, e
 * tutti e tre producono un numero PLAUSIBILE — cioe' il tipo di errore che
 * nessuno nota finche' non litiga:
 *
 *   1. dimenticare la pausa: 8:30-17:30 diventano 9 ore invece di 8, cioe'
 *      un'ora in piu' al giorno per tutti;
 *   2. contare un permesso di 2 ore come una giornata intera;
 *   3. trattare un festivo infrasettimanale come un giorno lavorativo.
 *
 * Il 2 e il 3 sono stati evitati non costruendoli: questo modulo NON calcola
 * un dovuto e NON calcola un saldo, e questa prova vigila che resti cosi'.
 * Il giorno che qualcuno li aggiungera', questi controlli si accendono e
 * chiedono di rileggere il perche' prima di procedere.
 *
 *   node --import ./scripts/alias.mjs scripts/ore-e-meteo-verify.mjs
 */
import { readFileSync } from "node:fs";

import {
  giornataAperta,
  giornateTra,
  inOre,
  lunediDi,
  minutiLavorati,
  minutiOltreOrario,
  PAUSA_PREDEFINITA_MINUTI,
  primoDelMeseDi,
  totaleMinuti,
} from "@/lib/timbrature.ts";
import { inKmOrari, leggiCielo, leggiMeteo } from "@/lib/meteo.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
const leggi = (p) => readFileSync(p, "utf8");

/** Il codice senza i commenti.
 *  Serve per i controlli che vietano qualcosa: in questo repo i commenti
 *  spiegano spesso PERCHE' una cosa non si fa, e nominarla li' dentro non e'
 *  farla. Senza questo filtro, la frase «non si usa force-dynamic» farebbe
 *  fallire il controllo che vieta force-dynamic. */
const senzaCommenti = (p) =>
  leggi(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

/** Una giornata timbrata, con orari scritti come li leggerebbe una persona. */
let n = 0;
const giornata = (giorno, dalle, alle, pausa = PAUSA_PREDEFINITA_MINUTI) => ({
  id: `g${++n}`,
  giorno,
  entrata: new Date(`${giorno}T${dalle}:00`).toISOString(),
  uscita: alle ? new Date(`${giorno}T${alle}:00`).toISOString() : null,
  pausa_minuti: pausa,
  pausa_misurata: false,
  corretta_at: null,
});

/* ------------------------------------------------------------------ */
console.log("\n# La giornata dell'ufficio: 8:30-17:30 fa OTTO ore, non nove\n");
/* ------------------------------------------------------------------ */

const classica = giornata("2026-09-21", "08:30", "17:30");
check(
  "Otto ore tonde",
  minutiLavorati(classica, new Date()) === 480,
  `${inOre(minutiLavorati(classica, new Date()))} — senza scalare la pausa sarebbero 9h, cioe' +20h al mese di straordinario inventato per tutti`,
);
check(
  "E non ne avanza nessuna oltre l'orario",
  minutiOltreOrario(classica, new Date()) === 0,
);

check(
  "Chi resta fino alle 19:30 ha due ore oltre l'orario",
  minutiOltreOrario(giornata("2026-09-21", "08:30", "19:30"), new Date()) === 120,
);

check(
  "Chi dichiara di non essersi fermato tiene la sua ora",
  minutiLavorati(giornata("2026-09-21", "08:30", "17:30", 0), new Date()) === 540,
  "la pausa e' il valore di serie, non un dazio",
);

/* Il caso che farebbe comparire un numero negativo. */
check(
  "Mezz'ora in ufficio non diventa meno di zero",
  minutiLavorati(giornata("2026-09-21", "09:00", "09:30"), new Date()) === 30,
  "la pausa si scala solo se la giornata era abbastanza lunga da contenerla",
);

/* ------------------------------------------------------------------ */
console.log("\n# La giornata ancora aperta\n");
/* ------------------------------------------------------------------ */

const aperta = giornata("2026-09-21", "08:30", null);
const alle12 = new Date("2026-09-21T12:00:00");
check(
  "Si conta fino ad adesso",
  minutiLavorati(aperta, alle12) === 150,
  `${inOre(minutiLavorati(aperta, alle12))} alle 12:00 (3h30 meno la pausa)`,
);
check("Si riconosce fra le altre", giornataAperta([classica, aperta])?.id === aperta.id);
check("E se sono tutte chiuse, non ce n'e'", giornataAperta([classica]) === null);

/* ------------------------------------------------------------------ */
console.log("\n# Come si leggono i numeri\n");
/* ------------------------------------------------------------------ */

check("Ore e minuti", inOre(492) === "8h 12m", inOre(492));
check("Ore tonde senza zeri inutili", inOre(480) === "8h", inOre(480));
check("Meno di un'ora", inOre(45) === "45m", inOre(45));
check("I minuti hanno sempre due cifre", inOre(485) === "8h 05m", inOre(485));

/* ------------------------------------------------------------------ */
console.log("\n# Settimane e mesi\n");
/* ------------------------------------------------------------------ */

check(
  "La settimana comincia di lunedi",
  lunediDi("2026-09-21") === "2026-09-21",
  "il 21 settembre 2026 e' un lunedi",
);
check(
  "E da domenica si guarda indietro, non avanti",
  lunediDi("2026-09-27") === "2026-09-21",
  "la domenica appartiene alla settimana che finisce",
);
check("Il mese parte dal primo", primoDelMeseDi("2026-09-21") === "2026-09-01");

const mese = [
  giornata("2026-09-21", "08:30", "17:30"),
  giornata("2026-09-18", "08:30", "17:30"),
  giornata("2026-08-31", "08:30", "17:30"),
];
check(
  "Il totale del mese non prende il mese prima",
  totaleMinuti(giornateTra(mese, "2026-09-01", "2026-09-30"), new Date()) === 960,
  "due giornate, non tre",
);
check(
  "E le giornate escono dalla piu' recente",
  giornateTra(mese, "2026-09-01", "2026-09-30")[0].giorno === "2026-09-21",
);

/* ------------------------------------------------------------------ */
console.log("\n# Quello che NON si calcola, e deve restare cosi'\n");
/* ------------------------------------------------------------------ */

const modulo = leggi("lib/timbrature.ts");
check(
  "Nessun «dovuto» e nessun «saldo»",
  !/export function (minutiDovuti|saldo|monteOre)/.test(modulo),
  "servirebbero i festivi infrasettimanali e i permessi a ore contabili: senza, il numero mente",
);
check(
  "La parola «straordinario» non compare accanto a un numero",
  !/straordinari[oa]/i.test(senzaCommenti("components/blocco-ore.tsx")),
  "ha un significato contrattuale che un CRM non puo' sostenere: si dice «oltre l'orario»",
);
check(
  "E il blocco lo dichiara a chi guarda",
  /orientativo/.test(leggi("components/blocco-ore.tsx")),
);

/* ------------------------------------------------------------------ */
console.log("\n# Le ore sono di chi le ha fatte\n");
/* ------------------------------------------------------------------ */

const m16 = leggi("supabase/migrations/20260921140000_m16_timbrature.sql");
const test = leggi("supabase/tests/rls.test.sql");

check(
  "Si vedono solo le proprie",
  /timbrature_select_proprie[\s\S]{0,200}using \(profile_id = \(select auth\.uid\(\)\)\)/.test(m16),
);
check(
  "Nemmeno un admin: non c'e' l'eccezione che hanno le altre tabelle",
  !/timbrature_select[\s\S]{0,300}is_admin\(\)/.test(m16),
  "le ferie sono un fatto organizzativo, l'ora in cui uno entra la mattina no",
);
check(
  "E c'e' il test che lo prova",
  /nemmeno un admin vede le ore altrui/.test(test),
);
check(
  "La RLS e le policy nascono nella stessa migrazione",
  /enable row level security/.test(m16) && /create policy timbrature_/.test(m16),
  "regola del repo: docs/SECURITY_MODEL.md",
);
check(
  "Una giornata non cambia data ne' proprietario",
  /non si cambia|non a chi e/.test(m16) && /timbrature_guard/.test(m16),
);
check(
  "Non si timbra per domani",
  /new\.giorno > \(current_date \+ 1\)/.test(m16),
);
check(
  "Una sola giornata aperta per volta",
  /timbrature_una_aperta_idx[\s\S]{0,120}where uscita is null/.test(m16),
);
check(
  "Le timbrature NON entrano in Realtime",
  !/timbrature/.test(leggi("lib/supabase/realtime.ts")),
  "cambiano solo per mano propria: un annuncio farebbe rileggere 18 tabelle a tutti",
);

/* ------------------------------------------------------------------ */
console.log("\n# Il meteo\n");
/* ------------------------------------------------------------------ */

check("Un codice noto diventa italiano", leggiCielo("partlycloudy_day").testo === "Nuvoloso a tratti");
check("Di notte cambia il simbolo, non le parole", leggiCielo("clearsky_night").simbolo === "🌙");
check(
  "Il temporale vince su tutto il resto",
  leggiCielo("rainshowersandthunder_day").testo === "Temporale",
  "se c'e' un temporale, e' quella la notizia",
);
check(
  "Un codice mai visto non rompe la dashboard",
  leggiCielo("qualcosa_di_nuovo_day").testo === "—",
  "il servizio puo' aggiungere varianti quando vuole",
);
check("Niente codice, niente eccezione", leggiCielo(undefined).testo === "—");
check("I metri al secondo diventano km/h", inKmOrari(1.4) === 5);

const finta = {
  properties: {
    meta: { updated_at: "2026-09-21T08:00:00Z" },
    timeseries: [
      {
        time: "2026-09-21T09:00:00Z",
        data: {
          instant: { details: { air_temperature: 25.3, wind_speed: 1.4 } },
          next_1_hours: { summary: { symbol_code: "partlycloudy_day" } },
        },
      },
      {
        time: "2026-09-21T10:00:00Z",
        data: {
          instant: { details: { air_temperature: 27.4, wind_speed: 2 } },
          next_1_hours: {
            summary: { symbol_code: "lightrain" },
            details: { precipitation_amount: 0.4 },
          },
        },
      },
    ],
  },
};
const letto = leggiMeteo(finta, 6);
check("I gradi si arrotondano", letto.adesso.gradi === 25, String(letto.adesso.gradi));
check("La striscia parte dall'ora DOPO", letto.prossime[0].gradi === 27, "«adesso» e' gia' scritto sopra in grande");
check("La pioggia prevista arriva", letto.prossime[0].pioggia === 0.4);
check("Una risposta vuota non e' un'eccezione", leggiMeteo({ properties: { meta: {}, timeseries: [] } }) === null);

const rotta = leggi("app/api/meteo/route.ts");
check(
  "La risposta si mette in cache",
  /cache: "force-cache"/.test(rotta) && /revalidate: QUARTO_DORA/.test(rotta),
  "in questa versione di Next la cache e' opt-in: senza, ogni apertura di dashboard e' una chiamata",
);
check(
  "E NON si usa force-dynamic",
  !/force-dynamic/.test(senzaCommenti("app/api/meteo/route.ts")),
  "equivale a no-store su ogni fetch: annullerebbe la cache appena messa",
);
check(
  "Si dichiara chi chiama, come il servizio pretende",
  /User-Agent/.test(rotta) && /lacertosus\.com/.test(rotta),
);
check(
  "Nessuna dipendenza nuova",
  !Object.keys({
    ...JSON.parse(leggi("package.json")).dependencies,
    ...JSON.parse(leggi("package.json")).devDependencies,
  }).some((d) => /weather|meteo|openweather/i.test(d)),
);

/* ------------------------------------------------------------------ */
console.log("\n# I blocchi nuovi non azzerano le dashboard di nessuno\n");
/* ------------------------------------------------------------------ */

const layout = leggi("lib/dashboard-layout.ts");
check(
  "LAYOUT_VERSION resta 1",
  /const LAYOUT_VERSION = 1;/.test(layout),
  "alzarla farebbe scartare il layout personalizzato di tutti e sei",
);
check("Il blocco delle ore è registrato", /ore: \{ title:/.test(layout));
check(
  "Il meteo NON è un blocco della dashboard",
  !/meteo: \{ title:/.test(layout),
  "era un riquadro grande accanto a cose che parlano di lavoro: troppo per una notizia",
);

const angolo = leggi("components/shell/meteo-angolo.tsx");
check(
  "Vive in un angolo, sotto i messaggi del toaster",
  /fixed right-4 bottom-4 z-40/.test(angolo),
  "un messaggio dura tre secondi e ha più diritto di farsi leggere",
);
check(
  "E sparisce se il servizio non risponde",
  /if \(!meteo\) return null;/.test(angolo),
  "un punto esclamativo per il meteo chiederebbe un'attenzione che non merita",
);

/* ------------------------------------------------------------------ */
console.log("\n# Chi esce e rientra\n");
/* ------------------------------------------------------------------ */

const storeOre = leggi("lib/store.tsx");
check(
  "Rientrando si riprende la giornata, non se ne apre una nuova",
  /const diOggi = timbrature\.find\(\(g\) => g\.giorno === oggi\)/.test(storeOre) &&
    /uscita: null,/.test(storeOre),
  "inserire una seconda riga sbatteva contro timbrature_una_per_giorno: chi rientrava dopo pranzo vedeva un errore di chiave duplicata",
);
check(
  "Il tempo passato fuori diventa pausa vera",
  /pausa_misurata \? diOggi\.pausa_minuti \+ fuoriMinuti : fuoriMinuti/.test(
    storeOre.replace(/\s+/g, " "),
  ),
  "la prima volta sostituisce l'ora presunta — sommarla la conterebbe due volte — dalla seconda si accumula",
);
check(
  "Una pausa scritta a mano vale come misurata",
  /pausa_minuti !== undefined[\s\S]{0,90}pausa_misurata: true/.test(storeOre),
  "è una pausa decisa: un rientro dopo deve sommarsi a quella",
);

/* ------------------------------------------------------------------ */
console.log("\n# La pagina dove si rettifica\n");
/* ------------------------------------------------------------------ */

const pagina = leggi("components/timbrature-content.tsx");
check("Ogni orario è scrivibile", /type="time"/.test(pagina));
check("Si può scrivere una giornata dimenticata", /aggiungiGiornata/.test(pagina));
check(
  "Una correzione lascia un segno",
  /corretta/.test(pagina),
  "un quaderno che non ricorda di essere stato riscritto è un quaderno di cui non ci si fida",
);
check(
  "E si dice perché gli orari si correggono",
  /computer che si accende/.test(pagina.replace(/\s+/g, " ")),
  "era la ragione portata dall'ufficio, e vale la pena scriverla dove serve",
);
check(
  "La pagina è raggiungibile",
  /href: "\/timbrature"/.test(leggi("components/shell/sidebar.tsx")),
);

/* ------------------------------------------------------------------ */
console.log("\n# Il mese si guarda, non si legge riga per riga\n");
/* ------------------------------------------------------------------ */

const grafico = leggi("components/charts/ore-del-mese.tsx");

check(
  "I colori del grafico vengono dai token, non scritti a mano",
  !/fill="#[0-9a-fA-F]{3,8}"/.test(senzaCommenti("components/charts/ore-del-mese.tsx")),
  "il tema scuro di questo prodotto e' vero: un grafite fisso su --card #191e27 e' una barra invisibile",
);
check(
  "Il riferimento della giornata piena c'e'",
  /GIORNATA_MINUTI = 8 \* 60/.test(grafico) && /strokeDasharray/.test(grafico),
  "senza una riga contro cui leggerle, 7h40 e 8h20 sono due numeri qualunque",
);
check(
  "La scala non si adatta al mese piu' tranquillo",
  /Math\.max\(\s*GIORNATA_MINUTI \* 1\.125/.test(grafico.replace(/\s+/g, " ")),
  "un tetto che segue il massimo del mese renderebbe due mesi diversi non confrontabili",
);
check(
  "Il colore non e' l'unica cosa che parla",
  /Entro le 8 ore/.test(grafico) &&
    /Oltre l&rsquo;orario/.test(grafico) &&
    /sr-only/.test(grafico),
  "l'ambra chiara sta a 2,09:1 sul bianco: il metodo la consente solo con legenda ed etichette diritte",
);
check(
  "I giorni vuoti restano vuoti",
  /g\.minuti === 0 \?/.test(grafico),
  "una linea che attraversa il sabato disegnerebbe un lavoro che non c'e' stato",
);

const paginaOre = leggi("components/timbrature-content.tsx");
check(
  "La pagina apre con i numeri, non con la tabella",
  /StatTile/.test(paginaOre) && /OreDelMese/.test(paginaOre),
);
check(
  "Ogni giorno del mese ha la sua colonna, weekend compresi",
  /giorniDelMese/.test(paginaOre) && /weekend:/.test(paginaOre),
);

check(
  "L'icona delle stat tile sta in un posto solo",
  /export function KpiIcon/.test(leggi("components/charts/kpi-icon.tsx")) &&
    !/function KpiIcon\(\{/.test(leggi("components/dashboard-content.tsx")),
  "due copie della stessa misura divergono al primo ritocco: su questo repo e' gia' successo con l'ordinamento e con i filtri",
);

const blocco = leggi("components/blocco-ore.tsx");
check(
  "Il blocco porta a «Le mie ore»",
  /href="\/timbrature"/.test(blocco),
  "il mese intero non ci sta in un riquadro della dashboard, ma ci deve portare",
);
check(
  "L'unica barra di avanzamento e' quella della giornata",
  /GIORNATA_MINUTI = 8 \* 60/.test(blocco) &&
    !/40 \* 60|MONTE_ORE|OBIETTIVO_/.test(senzaCommenti("components/blocco-ore.tsx")),
  "una barra «su 40 ore» sarebbe un dovuto, e il dovuto e' proprio il numero che qui non si puo' calcolare",
);

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
