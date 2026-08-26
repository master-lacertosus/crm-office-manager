/**
 * La produzione risponde davvero.
 *
 * Gli altri controlli guardano il codice: questo guarda il sito. Una build
 * verde e un deploy verde dicono che il pacchetto e' stato costruito e
 * caricato, non che le pagine si aprano — e la differenza si e' gia' vista
 * (una pagina che non si generava, un dominio che non esisteva, un
 * indirizzo che rispondeva con il login di Vercel invece che con l'app).
 *
 * Qui si chiede al sito vero, dall'esterno, senza credenziali: le pagine
 * rispondono, sono le nostre e non una schermata di Vercel, e le
 * correzioni recenti sono davvero quelle servite.
 *
 *   node scripts/produzione-verify.mjs
 *   BASE=https://... node scripts/produzione-verify.mjs
 */

const BASE = process.env.BASE ?? "https://lct-ufficio.vercel.app";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

async function apri(percorso) {
  try {
    const r = await fetch(`${BASE}${percorso}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    const corpo = await r.text();
    return {
      stato: r.status,
      titolo: corpo.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
      corpo,
    };
  } catch (e) {
    return { stato: 0, titolo: "", corpo: "", errore: String(e.message ?? e) };
  }
}

console.log(`Controllo ${BASE}\n`);

/* --- 1. Le pagine rispondono, e sono le nostre ----------------------- */
const PAGINE = [
  ["/", "l'ingresso"],
  ["/login", "l'accesso"],
  ["/dashboard", "la dashboard"],
  ["/tasks", "i task"],
  ["/calendar", "il calendario"],
  ["/projects", "i progetti"],
  ["/requests", "le richieste"],
  ["/leave", "le ferie"],
  ["/team", "il team"],
  ["/settings/profile", "le impostazioni"],
];

const risposte = new Map();
for (const [percorso, nome] of PAGINE) {
  const r = await apri(percorso);
  risposte.set(percorso, r);
  const nostra = /Lacertosus Office OS/.test(r.titolo);
  const vercel = /Login\s*[–-]\s*Vercel/.test(r.titolo);
  check(
    `${nome} risponde`,
    r.stato === 200 && nostra,
    vercel
      ? "risponde la protezione di Vercel, non l'app: gli invitati non passerebbero"
      : r.errore
        ? r.errore
        : `HTTP ${r.stato} · ${r.titolo || "senza titolo"}`,
  );
}

/* --- 2. La pagina di conferma capisce le tre forme del link ---------- */
{
  const conToken = await apri(
    "/auth/conferma?token_hash=finto&type=invite&next=/auth/imposta-password",
  );
  check(
    "Il link con token mostra il pulsante di conferma",
    conToken.corpo.includes("Ci siamo quasi"),
    "il token si consuma solo col POST, al riparo dagli scanner",
  );

  const senzaNiente = await apri("/auth/conferma");
  check(
    "Un link davvero vuoto lo dice",
    senzaNiente.corpo.includes("Link incompleto"),
  );
  check(
    "Ma prima prova a raccogliere il frammento",
    senzaNiente.corpo.includes("access_token|refresh_token"),
    "il frammento non arriva al server: se lo passa da solo",
  );
}

/* --- 3. Le correzioni recenti sono quelle servite -------------------- */
{
  const home = risposte.get("/");
  const fogli = [...new Set([...home.corpo.matchAll(/\/_next\/static\/[^"']+\.css/g)].map((m) => m[0]))];
  check("Il foglio di stile viene servito", fogli.length > 0, `${fogli.length} file`);

  let colorMix = 0;
  let arancioniFissi = 0;
  for (const f of fogli) {
    const css = await (await fetch(`${BASE}${f}`, { signal: AbortSignal.timeout(30_000) })).text();
    colorMix += (css.match(/color-mix/g) ?? []).length;
    arancioniFissi += (css.match(/255\s*,?\s*107\s*,?\s*0/g) ?? []).length;
  }
  check(
    "L'accento arriva alle CTA e allo sfondo",
    colorMix > 0,
    `${colorMix} usi di color-mix`,
  );
  check(
    "Nessun arancione scritto a mano",
    arancioniFissi === 0,
    arancioniFissi > 0
      ? `${arancioniFissi} rimasti: con un accento diverso stonerebbero`
      : "l'accento vale ovunque",
  );

  check(
    "Lo script che applica densita' e accento prima del disegno",
    home.corpo.includes("office-prefs"),
    "senza, la pagina si ridisegna a scala diversa dopo l'idratazione",
  );
}

console.log(
  falliti === 0
    ? "\nTUTTO VERDE — la produzione risponde e serve le correzioni"
    : `\n${falliti} CONTROLLI FALLITI`,
);
process.exit(falliti === 0 ? 0 : 1);
