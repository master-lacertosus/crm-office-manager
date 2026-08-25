/**
 * Le tre forme del link mandato per email.
 *
 * Supabase ne manda una diversa a seconda di come sono scritti i template:
 *
 *   1. `?token_hash=…&type=…`  template personalizzati (quelli del nostro
 *      documento). La pagina mostra il pulsante e il token si consuma solo
 *      con il POST, al riparo dagli scanner antivirus.
 *   2. `?code=…`               flusso PKCE, template predefiniti.
 *   3. `#access_token=…`       flusso implicito: il token sta nel FRAMMENTO,
 *      che il server non vede mai.
 *
 * La pagina /auth/conferma conosceva solo la prima. Alle altre due
 * rispondeva «Link incompleto» — a link perfettamente validi. Ed e'
 * esattamente cio' che si vede se non si sono riscritti tutti e quattro i
 * template: «Rimanda il link» usa quello di RECUPERO, non quello di invito.
 *
 * Prerequisito: server in ascolto (BASE, default :3210).
 *   node scripts/link-email-verify.mjs
 */

const BASE = process.env.BASE ?? "http://127.0.0.1:3210";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

async function apri(percorso) {
  const r = await fetch(`${BASE}${percorso}`, { redirect: "manual" });
  const corpo = r.status < 300 || r.status >= 400 ? await r.text() : "";
  return {
    stato: r.status,
    destinazione: r.headers.get("location"),
    corpo,
  };
}

/* --- 1. token_hash: il pulsante, senza consumare niente -------------- */
{
  const r = await apri(
    "/auth/conferma?token_hash=abc123&type=invite&next=/auth/imposta-password",
  );
  check(
    "token_hash: compare il pulsante di conferma",
    r.corpo.includes("Ci siamo quasi") && r.corpo.includes("Continua"),
    `HTTP ${r.stato}`,
  );
  check(
    "token_hash: il token viaggia in un modulo, non in un link",
    r.corpo.includes('method="post"') && r.corpo.includes('name="token_hash"'),
    "gli scanner aprono i link, non inviano i moduli",
  );
}

/* --- 2. code: si passa alla rotta che sa scambiarlo ------------------ */
{
  const r = await apri("/auth/conferma?code=xyz789&next=/auth/imposta-password");
  const vaAllaRotta =
    r.stato >= 300 &&
    r.stato < 400 &&
    (r.destinazione ?? "").includes("/auth/confirm") &&
    (r.destinazione ?? "").includes("code=xyz789");
  check(
    "code: inoltrato a /auth/confirm invece di dare link incompleto",
    vaAllaRotta,
    r.destinazione ?? `HTTP ${r.stato}, nessun rimando`,
  );
  check(
    "code: la destinazione finale viene conservata",
    (r.destinazione ?? "").includes(encodeURIComponent("/auth/imposta-password")),
    r.destinazione ?? "",
  );
}

/* --- 3. frammento: il server non lo vede, ci pensa il browser -------- */
{
  const r = await apri("/auth/conferma?next=/auth/imposta-password");
  check(
    "frammento: la pagina porta lo script che lo raccoglie",
    r.corpo.includes("access_token|refresh_token"),
    "il frammento non arriva al server: se lo passa da solo",
  );
  check(
    "frammento: lo script punta alla pagina giusta",
    r.corpo.includes('location.replace("/auth/imposta-password"'),
    "e la pagina della password sa gia' leggere il frammento",
  );
}

/* --- 4. davvero vuoto: il messaggio d'errore resta, ed e' vero ------- */
{
  const r = await apri("/auth/conferma");
  check(
    "senza niente: resta «Link incompleto»",
    r.corpo.includes("Link incompleto") &&
      r.corpo.includes("Richiedi un link nuovo"),
    "quando non c'e' davvero niente, dirlo e' corretto",
  );
}

/* --- 5. destinazione esterna: non si diventa un trampolino ----------- */
{
  const r = await apri(
    "/auth/conferma?code=abc&next=https://sito-esterno.example/rubare",
  );
  const finisceFuori = /sito-esterno/.test(r.destinazione ?? "");
  check(
    "una destinazione esterna viene scartata",
    !finisceFuori,
    r.destinazione ?? "",
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
