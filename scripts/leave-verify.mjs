/**
 * Verifica Ferie & Permessi via Edge headless CDP (:9223).
 * Flusso: pagina /leave (calendario, chiusure, coda admin) → nuova
 * richiesta dal form → approvazione con nota → rifiuto motivato →
 * notifiche in localStorage (richiedente + altri admin) → presenze su
 * dashboard e standup. Stampa PASS/FAIL per sezione.
 */

const PORT = 9223;
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

await send("Runtime.enable");
await send("Page.enable");

const U = {
  sara: "00000000-0000-4000-8000-000000000002",
  lorenzo: "00000000-0000-4000-8000-000000000003",
  enrico: "00000000-0000-4000-8000-000000000006",
};

/* ---------- 1. Pagina /leave: calendario, chiusure, coda admin -------- */
await ev(`location.href = 'http://localhost:3000/leave?tour=0'; true`);
await sleep(3500);

const pageProbe = await ev(`(() => {
  const cal = document.querySelector('section[aria-label="Calendario dell\\'ufficio"]');
  const body = document.body.textContent;
  const queue = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Da approvare')?.closest('section');
  return {
    calendario: !!cal,
    chiusura: body.includes('Ponte di Ferragosto'),
    oggiFuori: body.includes('Oggi fuori:') && body.includes('Riccardo'),
    pillKlea: cal ? cal.textContent.includes('Klea') : false,
    legenda: body.includes('Chiusura aziendale') && body.includes('In attesa di approvazione'),
    badgeFerie: (document.querySelector('a[href="/leave"]')?.textContent ?? '').includes('2'),
    codaCards: queue ? queue.querySelectorAll('.card-soft').length : 0,
    urgenza: queue ? /parte (tra 1 g|oggi)/.test(queue.textContent) : false,
    conflitto: queue ? queue.textContent.includes('già fuori: Klea') : false,
  };
})()`);
check("Calendario ufficio renderizzato", pageProbe.calendario === true, JSON.stringify(pageProbe));
check("Chiusura «Ponte di Ferragosto» visibile", pageProbe.chiusura === true);
check("Riepilogo «Oggi fuori» con Riccardo (permesso)", pageProbe.oggiFuori === true);
check("Pill di Klea (ferie approvate) sul calendario", pageProbe.pillKlea === true);
check("Legenda con chiusure e stato in attesa", pageProbe.legenda === true);
check("Badge sidebar «Ferie» = 2 in attesa (admin)", pageProbe.badgeFerie === true);
check("Coda admin: 2 richieste da approvare", pageProbe.codaCards === 2, `${pageProbe.codaCards} card`);
check("Urgenza «parte tra 1 g» sul permesso di Lorenzo", pageProbe.urgenza === true);
check("Avviso sovrapposizione: «già fuori: Klea»", pageProbe.conflitto === true);

/* ---------- 2. Nuova richiesta dal form ------------------------------- */
await ev(`[...document.querySelectorAll('header button')].find((b) => b.textContent.includes('Richiedi'))?.click(); true`);
await sleep(700);
const formOpen = await ev(`document.body.textContent.includes('Nuova richiesta')`);
check("Form aperto dal bottone in topbar (?request=1)", formOpen === true);

await ev(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const start = document.querySelector('input[aria-label="Primo giorno"]');
  set.call(start, '${iso(2)}');
  start.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(200);
await ev(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const end = document.querySelector('input[aria-label="Ultimo giorno"]');
  set.call(end, '${iso(3)}');
  end.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(400);
const summary = await ev(`(() => {
  const form = document.querySelector('form');
  return {
    giorni: /giorn\\w lavorativ/.test(form?.textContent ?? ''),
    anche: (form?.textContent ?? '').includes('fuori anche Klea'),
  };
})()`);
check("Conteggio giorni lavorativi nel form", summary.giorni === true, JSON.stringify(summary));
check("Info «in quei giorni fuori anche Klea»", summary.anche === true);

await ev(`[...document.querySelectorAll('form button')].find((b) => b.textContent.includes('Invia richiesta'))?.click(); true`);
await sleep(900);
const afterCreate = await ev(`(() => {
  const body = document.body.textContent;
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Le mie richieste')?.closest('section');
  const cal = document.querySelector('section[aria-label="Calendario dell\\'ufficio"]');
  const pendingPill = cal ? [...cal.querySelectorAll('span[title]')].some((s) => (s.title.includes('Francesco') && s.title.includes('in attesa'))) : false;
  return {
    toast: body.includes('Richiesta inviata'),
    formChiuso: !body.includes('Nuova richiesta'),
    riga: mine ? mine.textContent.includes('In attesa') : false,
    pillPending: pendingPill,
  };
})()`);
check("Invio: toast e chiusura form", afterCreate.toast && afterCreate.formChiuso, JSON.stringify(afterCreate));
check("La richiesta appare in «Le mie richieste»", afterCreate.riga === true);
check("Pill tratteggiata (in attesa) sul calendario", afterCreate.pillPending === true);

/* ---------- 3. Approvazione con nota (permesso di Lorenzo) ------------ */
await ev(`(() => {
  const queue = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Da approvare')?.closest('section');
  const card = [...(queue?.querySelectorAll('.card-soft') ?? [])].find((c) => c.textContent.includes('Lorenzo'));
  [...(card?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'Approva')?.click();
  return true;
})()`);
await sleep(500);
await ev(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const input = document.querySelector('input[aria-label="Nota di approvazione"]');
  set.call(input, 'Buona commissione, ci copriamo noi.');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(200);
await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Conferma approvazione'))?.click(); true`);
await sleep(900);
const afterApprove = await ev(`(() => {
  const queue = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Da approvare')?.closest('section');
  return {
    toast: document.body.textContent.includes('Richiesta approvata'),
    lorenzoFuoriCoda: queue ? !queue.textContent.includes('Lorenzo') : false,
  };
})()`);
check("Approvazione: toast di conferma", afterApprove.toast === true, JSON.stringify(afterApprove));
check("Lorenzo non è più in coda", afterApprove.lorenzoFuoriCoda === true);

/* ---------- 4. Rifiuto motivato (ferie di Enrico) --------------------- */
await ev(`(() => {
  const queue = [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Da approvare')?.closest('section');
  const card = [...(queue?.querySelectorAll('.card-soft') ?? [])].find((c) => c.textContent.includes('Enrico'));
  [...(card?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === 'Rifiuta')?.click();
  return true;
})()`);
await sleep(500);
const rejectGuard = await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Conferma rifiuto'));
  return btn ? btn.disabled : null;
})()`);
check("Rifiuto: conferma disabilitata senza motivo", rejectGuard === true, String(rejectGuard));
await ev(`(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const input = document.querySelector('input[aria-label="Motivo del rifiuto"]');
  set.call(input, 'Settimana di punta, riproponi dopo il 25.');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(200);
await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Conferma rifiuto'))?.click(); true`);
await sleep(1200);

/* ---------- 5. Notifiche persistite: richiedente + altri admin -------- */
const notif = await ev(`(() => {
  const state = JSON.parse(localStorage.getItem('office-state') ?? '{}');
  const ns = state.notifications ?? [];
  const msg = (uid, frag) => ns.some((n) => n.to_user_id === uid && n.message.includes(frag));
  return {
    approvaLorenzo: msg('${U.lorenzo}', 'Permesso approvato'),
    notaLorenzo: msg('${U.lorenzo}', 'Buona commissione'),
    approvaSara: msg('${U.sara}', 'ha approvato il permesso di Lorenzo'),
    rifiutoEnrico: msg('${U.enrico}', 'Ferie non approvate'),
    motivoEnrico: msg('${U.enrico}', 'riproponi dopo il 25'),
    rifiutoSara: msg('${U.sara}', 'ha rifiutato le ferie di Enrico'),
    nuovaRichiestaSara: msg('${U.sara}', 'chiede ferie'),
  };
})()`);
check("Notifica a Lorenzo: permesso approvato con nota", notif.approvaLorenzo && notif.notaLorenzo, JSON.stringify(notif));
check("Notifica all'altro admin (Sara): approvazione", notif.approvaSara === true);
check("Notifica a Enrico: rifiuto con motivazione", notif.rifiutoEnrico && notif.motivoEnrico);
check("Notifica all'altro admin (Sara): rifiuto", notif.rifiutoSara === true);
check("Notifica agli admin per la nuova richiesta", notif.nuovaRichiestaSara === true);

/* ---------- 6. Presenze su dashboard e standup ------------------------ */
await ev(`location.href = 'http://localhost:3000/dashboard?tour=0'; true`);
await sleep(3000);
const pulse = await ev(`(() => {
  const el = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Polso del team'))?.closest('section');
  return el ? el.textContent.includes('Permesso') : 'sezione mancante';
})()`);
check("Polso del team: Riccardo segnato «Permesso» oggi", pulse === true, String(pulse));

await ev(`location.href = 'http://localhost:3000/dashboard?tour=0&standup=1'; true`);
await sleep(2500);
const standup = await ev(`(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Modalità standup"]');
  return dlg ? dlg.textContent.includes('Permesso 14:00–18:00') : 'standup chiuso';
})()`);
check("Standup: chip «Permesso 14:00–18:00» su Riccardo", standup === true, String(standup));

console.log(`\n[eccezioni] ${JSON.stringify(exceptions)}`);
console.log(failures === 0 ? "\nTUTTO VERDE" : `\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);
