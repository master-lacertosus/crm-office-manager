/**
 * Verifica della creazione di un task dal pannello: conferma visibile
 * (toast + spunta «Creato»), passaggio al dettaglio, nessun doppione al
 * secondo salvataggio e igiene dell'URL (?due= del calendario).
 *
 * Prerequisiti: build di produzione servita + browser headless con CDP
 * sulla porta 9223. La base è configurabile:
 *   CRM_URL=http://localhost:3210 node scripts/create-task-verify.mjs
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
    exceptions.push(
      msg.params.exceptionDetails.exception?.description?.slice(0, 200) ?? "?",
    );
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

/** Scrive in un campo controllato da React (native setter + evento). */
const setField = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

await send("Runtime.enable");
await send("Page.enable");

/* Prima visita: niente tour né Capo davanti al pannello. */
await ev(`location.href = '${BASE}/tasks?tour=0'; true`);
await sleep(4000);
await ev(`(() => {
  const d = new Date();
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  localStorage.setItem('ilcapo-off-until', iso);
  localStorage.setItem('tour-done', '1');
  return true;
})()`);
await ev(`location.reload(); true`);
await sleep(4000);

const TITOLO = "Verifica conferma creazione";

/* ---------- 1. Creazione dal pannello ---------------------------------- */
await ev(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Nuovo task'))?.click(); true`);
await sleep(1200);
const aperto = await ev(`(() => ({
  dialog: document.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
  url: location.search,
}))()`);
check(
  "Pannello di creazione aperto su ?task=new",
  aperto.dialog === "Nuovo task" && aperto.url.includes("task=new"),
  JSON.stringify(aperto),
);

await ev(setField("#task-title", TITOLO));
await sleep(300);

const creato = await ev(`(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Crea task'));
  if (!btn) return { errore: 'bottone Crea task assente' };
  const t0 = performance.now();
  btn.click();
  for (let i = 0; i < 150; i++) {
    if (location.search.includes('task=') && !location.search.includes('task=new')) break;
    await new Promise(r => setTimeout(r, 10));
  }
  const ms = Math.round(performance.now() - t0);
  await new Promise(r => setTimeout(r, 350));
  const dlg = document.querySelector('[role="dialog"]');
  const live = document.querySelector('[aria-live="polite"]');
  const spunta = [...(dlg?.querySelectorAll('[role="status"]') ?? [])].map(n => n.textContent.trim());
  return {
    ms,
    url: location.search,
    toast: (live?.textContent ?? '').trim(),
    spunta,
    dettaglio: !!dlg && dlg.textContent.includes('Salva modifiche'),
    sullaBoard: [...document.querySelectorAll('[data-card-id]')].filter(c => c.textContent.includes(${JSON.stringify(TITOLO)})).length,
  };
})()`);
check(
  "Toast di conferma dopo il salvataggio",
  creato.toast?.includes(TITOLO) && /creato/i.test(creato.toast ?? ""),
  JSON.stringify(creato.toast),
);
check(
  "Spunta «Creato» nel pannello appena creato",
  creato.spunta?.some((t) => t === "Creato"),
  JSON.stringify(creato.spunta),
);
check(
  "Il pannello passa al dettaglio del task creato",
  creato.dettaglio === true && !creato.url?.includes("task=new") && creato.url?.includes("task="),
  JSON.stringify({ url: creato.url, dettaglio: creato.dettaglio, ms: creato.ms }),
);
check(
  "Il task compare sulla board una sola volta",
  creato.sullaBoard === 1,
  `card trovate: ${creato.sullaBoard}`,
);

/* ---------- 2. Salvataggio delle modifiche ----------------------------- */
await ev(setField("#task-title", `${TITOLO} (rivisto)`));
await sleep(300);
const salvato = await ev(`(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Salva modifiche'));
  if (!btn) return { errore: 'bottone Salva modifiche assente' };
  btn.click();
  await new Promise(r => setTimeout(r, 600));
  const dlg = document.querySelector('[role="dialog"]');
  return {
    spunta: [...(dlg?.querySelectorAll('[role="status"]') ?? [])].map(n => n.textContent.trim()),
    cards: [...document.querySelectorAll('[data-card-id]')].filter(c => c.textContent.includes(${JSON.stringify(TITOLO)})).length,
  };
})()`);
check(
  "Spunta «Salvato» dopo una modifica, senza task doppio",
  salvato.spunta?.some((t) => t === "Salvato") && salvato.cards === 1,
  JSON.stringify(salvato),
);

await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
await sleep(700);

/* ---------- 3. Igiene dell'URL: ?due= del calendario ------------------- */
await ev(`location.href = '${BASE}/calendar?tour=0'; true`);
await sleep(3500);
const dal = await ev(`(async () => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Nuovo task '));
  if (!btn) return { errore: 'pulsante + del giorno assente' };
  btn.click();
  await new Promise(r => setTimeout(r, 1200));
  return { conDue: location.search, scadenza: document.querySelector('#task-due')?.value ?? null };
})()`);
check(
  "Dal calendario il + precompila la scadenza (?due=)",
  dal.conDue?.includes("due=") && !!dal.scadenza,
  JSON.stringify(dal),
);

await ev(setField("#task-title", "Verifica scadenza da calendario"));
await sleep(300);
const dopo = await ev(`(async () => {
  [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Crea task'))?.click();
  await new Promise(r => setTimeout(r, 900));
  const url = location.search;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise(r => setTimeout(r, 700));
  return { dopoCreazione: url, dopoChiusura: location.search };
})()`);
check(
  "Dopo la creazione l'URL non trascina più ?due=",
  !dopo.dopoCreazione?.includes("due="),
  JSON.stringify(dopo.dopoCreazione),
);
check(
  "Chiudendo il pannello l'URL resta pulito (né task né due)",
  !dopo.dopoChiusura?.includes("due=") && !dopo.dopoChiusura?.includes("task="),
  JSON.stringify(dopo.dopoChiusura),
);

console.log("\n[eccezioni]", JSON.stringify(exceptions.slice(0, 5)));
console.log(failures === 0 ? "\nTUTTO VERDE" : `\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
