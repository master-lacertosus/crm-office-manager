/**
 * Verifica delle ricorrenze: il menu offre tutte le cadenze e, completando
 * un task ricorrente, il giro successivo nasce con la scadenza giusta —
 * feriali che scavalcano il weekend e nessuna scadenza nel passato.
 *
 * Prerequisiti: build di produzione servita + browser headless con CDP
 * sulla porta 9223. La base è configurabile:
 *   CRM_URL=http://localhost:3210 node scripts/repeat-verify.mjs
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

/* Date attese, calcolate qui in Node: se le calcolasse la pagina userebbe la
   stessa funzione sotto esame e il controllo non proverebbe nulla. */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daOggi = (giorni) => { const d = new Date(); d.setDate(d.getDate() + giorni); return iso(d); };
/** Prossimo venerdì (o oggi se è venerdì). */
function prossimoVenerdi() {
  const d = new Date();
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return iso(d);
}
const piuGiorni = (isoStr, giorni) => {
  const [y, m, g] = isoStr.split("-").map(Number);
  return iso(new Date(y, m - 1, g + giorni));
};

const setField = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  return el.value;
})()`;

await send("Runtime.enable");
await send("Page.enable");

await ev(`location.href = '${BASE}/tasks?tour=0'; true`);
await sleep(4000);
await ev(`(() => {
  const d = new Date();
  const oggi = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  localStorage.setItem('ilcapo-off-until', oggi);
  localStorage.setItem('tour-done', '1');
  return true;
})()`);
await ev(`location.reload(); true`);
await sleep(4000);

/* ---------- 1. Il menu offre tutte le cadenze -------------------------- */
await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Nuovo task'))?.click(); true`);
await sleep(1200);
const opzioni = await ev(`[...(document.getElementById('task-repeat')?.options ?? [])].map(o => o.value)`);
const attese = ["none", "daily", "weekdays", "every_other_day", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
check(
  "Il menu Ripetizione offre tutte le cadenze, nell'ordine",
  Array.isArray(opzioni) && attese.every((v, i) => opzioni[i] === v) && opzioni.length === attese.length,
  JSON.stringify(opzioni),
);

/**
 * Crea un task ricorrente, lo completa e restituisce la scadenza del giro
 * successivo (letta dal pannello del task rinato).
 */
async function giroSuccessivo(titolo, cadenza, scadenza) {
  await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Nuovo task'))?.click(); true`);
  await sleep(1000);
  await ev(setField("#task-title", titolo));
  await ev(setField("#task-due", scadenza));
  await ev(setField("#task-repeat", cadenza));
  await sleep(300);
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Crea task'))?.click(); true`);
  await sleep(1200);

  // Completa: stato «Fatto» e salva.
  await ev(setField("#task-status", "done"));
  await sleep(300);
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Salva modifiche'))?.click(); true`);
  await sleep(1200);
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(900);

  // Il giro nuovo nasce in «Da fare»: aprilo e leggi la scadenza.
  const aperto = await ev(`(() => {
    const lane = document.querySelector('section[aria-label="Da fare"]');
    const card = [...(lane?.querySelectorAll('[data-card-id]') ?? [])]
      .find(c => c.textContent.includes(${JSON.stringify(titolo)}));
    if (!card) return false;
    card.querySelector('a')?.click();
    return true;
  })()`);
  if (!aperto) return { errore: "giro successivo non trovato in «Da fare»" };
  await sleep(1200);
  const dati = await ev(`({
    scadenza: document.querySelector('#task-due')?.value ?? null,
    cadenza: document.querySelector('#task-repeat')?.value ?? null,
    stato: document.querySelector('#task-status')?.value ?? null,
  })`);
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(800);
  return dati;
}

/* ---------- 2. Ogni giorno --------------------------------------------- */
const oggi = daOggi(0);
const giornaliero = await giroSuccessivo("Ricorrenza quotidiana", "daily", oggi);
check(
  "Ogni giorno: il giro successivo scade domani, sempre ricorrente",
  giornaliero.scadenza === daOggi(1) && giornaliero.cadenza === "daily" && giornaliero.stato !== "done",
  JSON.stringify({ atteso: daOggi(1), ottenuto: giornaliero }),
);

/* ---------- 3. Giorni feriali: il venerdì salta al lunedì -------------- */
const venerdi = prossimoVenerdi();
const feriale = await giroSuccessivo("Ricorrenza feriale", "weekdays", venerdi);
check(
  "Giorni feriali: da venerdì si passa a lunedì, weekend saltato",
  feriale.scadenza === piuGiorni(venerdi, 3),
  JSON.stringify({ venerdi, atteso: piuGiorni(venerdi, 3), ottenuto: feriale.scadenza }),
);

/* ---------- 4. A giorni alterni ---------------------------------------- */
const alterni = await giroSuccessivo("Ricorrenza a giorni alterni", "every_other_day", oggi);
check(
  "A giorni alterni: il giro successivo scade fra due giorni",
  alterni.scadenza === daOggi(2),
  JSON.stringify({ atteso: daOggi(2), ottenuto: alterni.scadenza }),
);

/* ---------- 5. Completamento in ritardo: niente scadenze passate ------- */
const inRitardo = await giroSuccessivo("Ricorrenza in ritardo", "daily", daOggi(-10));
check(
  "Completato in ritardo: la nuova scadenza non nasce nel passato",
  typeof inRitardo.scadenza === "string" && inRitardo.scadenza >= oggi,
  JSON.stringify({ scadenzaVecchia: daOggi(-10), oggi, ottenuto: inRitardo.scadenza }),
);

/* ---------- 6. Cadenza lunga: trimestrale ------------------------------ */
const trimestrale = await giroSuccessivo("Ricorrenza trimestrale", "quarterly", oggi);
const atteso3Mesi = (() => {
  const [y, m, g] = oggi.split("-").map(Number);
  const primo = new Date(y, m - 1 + 3, 1);
  const ultimo = new Date(primo.getFullYear(), primo.getMonth() + 1, 0).getDate();
  return iso(new Date(primo.getFullYear(), primo.getMonth(), Math.min(g, ultimo)));
})();
check(
  "Ogni 3 mesi: la scadenza avanza di un trimestre",
  trimestrale.scadenza === atteso3Mesi,
  JSON.stringify({ atteso: atteso3Mesi, ottenuto: trimestrale.scadenza }),
);

console.log("\n[eccezioni]", JSON.stringify(exceptions.slice(0, 5)));
console.log(failures === 0 ? "\nTUTTO VERDE" : `\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
