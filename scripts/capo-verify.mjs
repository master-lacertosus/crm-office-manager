/**
 * Verifica che il Capo resti fuori scena: né da solo, né forzandolo.
 * Prerequisiti: build di produzione servita + CDP su 9223.
 */
const PORT = 9223;
const BASE = process.env.CRM_URL ?? "http://localhost:3000";
let falliti = 0;
const check = (nome, ok, dettaglio = "") => {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
};

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pend = new Map();
const errori = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method === "Runtime.exceptionThrown") errori.push(m.params.exceptionDetails.exception?.description?.slice(0, 160) ?? "?");
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
  setTimeout(() => rej(new Error("TIMEOUT " + method)), 20000);
});
const ev = async (x) => {
  const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Il Capo si riconosce dal pulsante di congedo e dalla sua firma. */
const CERCA = `(() => ({
  bottone: !!document.querySelector('[aria-label="Chiudi il Capo"]'),
  firma: /CAVALIERE|CLAUDIO P\\./i.test(document.body.innerText),
  nonOggi: document.body.innerText.includes('Non oggi'),
}))()`;

await send("Runtime.enable");
await send("Page.enable");

/* 1. Dashboard: il Capo compariva entro ~4 secondi dall'ingresso. */
await ev(`location.href = '${BASE}/dashboard?tour=0'; true`);
await sleep(9000);
const spontaneo = await ev(CERCA);
check(
  "Non compare da solo, nemmeno dopo nove secondi",
  spontaneo.bottone === false && spontaneo.firma === false,
  JSON.stringify(spontaneo),
);

/* 2. Forzato dal parametro di debug. */
await ev(`location.href = '${BASE}/dashboard?tour=0&capo=1'; true`);
await sleep(7000);
const forzato = await ev(CERCA);
check(
  "Non compare nemmeno con ?capo=1",
  forzato.bottone === false && forzato.firma === false,
  JSON.stringify(forzato),
);

/* 3. Evocato dall'evento che usava la palette. */
await ev(`window.dispatchEvent(new Event('capo:summon')); true`);
await sleep(2500);
const evocato = await ev(CERCA);
check(
  "Non risponde all'evocazione",
  evocato.bottone === false && evocato.firma === false,
  JSON.stringify(evocato),
);

/* 4. La palette non offre più un comando che non fa niente. */
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`);
await sleep(1200);
const palette = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Comandi rapidi"]');
  return { aperta: !!dlg, evoca: (dlg?.textContent ?? '').includes('Evoca il Capo') };
})()`);
check(
  "La palette non elenca più «Evoca il Capo»",
  palette.aperta === true && palette.evoca === false,
  JSON.stringify(palette),
);

console.log("\n[eccezioni]", JSON.stringify(errori.slice(0, 3)));
console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
ws.close();
process.exit(falliti === 0 ? 0 : 1);
