/**
 * Verifica del percorso di invito e recupero accesso.
 *
 * Quello che si può controllare senza database: la pagina di conferma non
 * consuma il token (mostra un pulsante e lo tiene in un modulo POST), il link
 * incompleto non lascia a piedi, e la pagina di accesso mostra il motivo per
 * cui ci si è finiti — cosa che prima non faceva.
 *
 * La verifica dal vivo (invito vero, casella aziendale) sta in
 * docs/AUTH_SETUP.md: richiede un progetto Supabase configurato.
 *
 * Prerequisiti: build di produzione servita + browser headless con CDP sulla
 * porta 9223. Base configurabile:
 *   CRM_URL=http://localhost:3210 node scripts/invite-flow-verify.mjs
 */

const PORT = 9223;
const BASE = process.env.CRM_URL ?? "http://localhost:3000";
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const exceptions = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") {
    exceptions.push(msg.params.exceptionDetails.exception?.description?.slice(0, 200) ?? "?");
  }
};
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`TIMEOUT ${method}`)); } }, 25_000);
  });
}
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { evalError: r.result.exceptionDetails.text ?? "err" };
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vai = async (percorso, attesa = 2200) => {
  await ev(`location.href = '${BASE}${percorso}'; true`);
  await sleep(attesa);
};

await send("Runtime.enable");
await send("Page.enable");

/* ---------- 1. Il token non si consuma da solo ------------------------- */
await vai("/auth/conferma?token_hash=finto-per-la-prova&type=invite&next=/auth/imposta-password");
const conferma = await ev(`(() => {
  const form = document.querySelector('form[action="/auth/confirm"]');
  const campi = form
    ? Object.fromEntries([...form.querySelectorAll('input[type=hidden]')].map(i => [i.name, i.value]))
    : null;
  return {
    metodo: form?.method ?? null,
    campi,
    pulsante: [...document.querySelectorAll('button')].some(b => b.textContent.includes('Continua')),
    testo: document.body.innerText.slice(0, 60).replace(/\\s+/g, ' '),
  };
})()`);
check(
  "La conferma aspetta un POST: token nel modulo, non speso col caricamento",
  conferma.metodo === "post" &&
    conferma.campi?.token_hash === "finto-per-la-prova" &&
    conferma.campi?.type === "invite" &&
    conferma.campi?.next === "/auth/imposta-password" &&
    conferma.pulsante === true,
  JSON.stringify(conferma),
);

/* ---------- 2. Link senza codice: non è un vicolo cieco ---------------- */
await vai("/auth/conferma");
const incompleto = await ev(`(() => ({
  spiega: document.body.innerText.includes('Link incompleto'),
  viaDuscita: [...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/login?recupero=1'),
  moduloAssente: !document.querySelector('form[action="/auth/confirm"]'),
}))()`);
check(
  "Link senza codice: spiega il problema e offre un link nuovo",
  incompleto.spiega && incompleto.viaDuscita && incompleto.moduloAssente,
  JSON.stringify(incompleto),
);

/* ---------- 3. Link bruciato: l'accesso dice cosa è successo ------------ */
const motivo = "Il link è scaduto: qui sotto puoi fartene mandare uno nuovo.";
await vai(`/login?recupero=1&errore=${encodeURIComponent(motivo)}`, 2600);
const rientro = await ev(`(() => ({
  recuperoAperto: document.body.innerText.includes('Recupera l'),
  avviso: [...document.querySelectorAll('[role="alert"]')].map(n => n.textContent.trim()),
  campoEmail: !!document.getElementById('reset-email'),
}))()`);
check(
  "Link bruciato: recupero già aperto e motivo in chiaro",
  rientro.recuperoAperto === true &&
    rientro.campoEmail === true &&
    rientro.avviso?.some((t) => t.includes("scaduto")),
  JSON.stringify(rientro),
);

/* ---------- 4. L'accesso normale resta quello di sempre ---------------- */
await vai("/login", 2600);
const normale = await ev(`(() => ({
  form: !!document.getElementById('login-password'),
  recupero: document.body.innerText.includes('Recupera l'),
  avvisi: document.querySelectorAll('[role="alert"]').length,
}))()`);
check(
  "Senza parametri l'accesso è quello normale, senza avvisi",
  normale.form === true && normale.recupero === false && normale.avvisi === 0,
  JSON.stringify(normale),
);

console.log("\n[eccezioni]", JSON.stringify(exceptions.slice(0, 5)));
console.log(failures === 0 ? "\nTUTTO VERDE" : `\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
