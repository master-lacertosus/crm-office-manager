/**
 * Il salto di scala a ogni ricaricamento.
 *
 * `--spacing` e' l'unita' da cui Tailwind v4 deriva OGNI misura: margini,
 * imbottiture, distanze, altezze. La densita' scelta in Impostazioni lo
 * rimappa, quindi cambiarla non ritocca un dettaglio: riscala l'interfaccia
 * intera.
 *
 * Il difetto: la densita' veniva applicata da un effetto React, cioe' dopo
 * che il browser aveva gia' dipinto tutto alla misura predefinita. Si vedeva
 * la pagina a una scala e poi saltare all'altra. Zoom e dezoom.
 *
 * Qui si misura il primo fotogramma: si legge `--spacing` al momento stesso
 * in cui il documento comincia a esistere, prima che qualunque codice
 * dell'app abbia girato. Se gia' li' il valore e' quello scelto, il salto
 * non puo' esistere.
 *
 * Prerequisiti: server su :3210, Chrome con --remote-debugging-port=9223.
 *   node scripts/primo-disegno-verify.mjs
 */

const PORT = 9223;
const BASE = process.env.BASE ?? "http://127.0.0.1:3210/dashboard";

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) {
  console.error("Nessuna scheda su :9223. Chrome e' avviato con --remote-debugging-port?");
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.exceptionDetails
    ? { ERR: r.result.exceptionDetails.exception?.description?.slice(0, 140) }
    : r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let falliti = 0;
const check = (nome, ok, dettaglio = "") => {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
};

await send("Page.enable");
await send("Runtime.enable");

/* Il campionatore parte col documento, prima di ogni altro script della
   pagina: cosi' il primo campione e' davvero il primo stato possibile. */
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__misure = { primo: null, dopo: null };
    const leggi = () => ({
      spacing: getComputedStyle(document.documentElement)
        .getPropertyValue("--spacing").trim(),
      densita: document.documentElement.getAttribute("data-density"),
      accento: document.documentElement.getAttribute("data-accent"),
    });
    // Primo fotogramma utile: appena il foglio di stile e' applicabile.
    document.addEventListener("DOMContentLoaded", () => {
      if (!window.__misure.primo) window.__misure.primo = leggi();
    });
    requestAnimationFrame(() => {
      if (!window.__misure.primo) window.__misure.primo = leggi();
    });
    setTimeout(() => { window.__misure.dopo = leggi(); }, 2500);
  `,
});

async function provaCon(preferenze) {
  await send("Page.navigate", { url: BASE });
  await sleep(600);
  await ev(`localStorage.setItem("office-prefs", ${JSON.stringify(JSON.stringify(preferenze))})`);
  await send("Page.navigate", { url: BASE });
  await sleep(3200);
  return await ev("JSON.stringify(window.__misure)");
}

/* --- 1. Densita' compatta: il caso che si vedeva --------------------- */
const grezzo1 = await provaCon({ accent: "orange", density: "compact", reduceMotion: false });
const m1 = JSON.parse(grezzo1 || "{}");
if (!m1.primo) {
  console.error("Misura non riuscita: il campionatore non ha prodotto dati.");
  process.exit(1);
}
console.log(`  primo fotogramma : --spacing=${m1.primo.spacing}  data-density=${m1.primo.densita ?? "assente"}`);
console.log(`  dopo l'assesto   : --spacing=${m1.dopo?.spacing}  data-density=${m1.dopo?.densita ?? "assente"}\n`);

check(
  "Densita' compatta: il primo fotogramma e' gia' quello giusto",
  m1.primo.densita === "compact" && m1.primo.spacing === ".22rem",
  m1.primo.densita === "compact"
    ? "nessun salto da smorzare"
    : `il primo disegno usa ${m1.primo.spacing} e poi salta: l'interfaccia si ridisegna a scala diversa`,
);
check(
  "Densita' compatta: niente cambia dopo il primo fotogramma",
  m1.dopo && m1.primo.spacing === m1.dopo.spacing,
  `${m1.primo.spacing} -> ${m1.dopo?.spacing}`,
);

/* --- 2. Accento diverso: nessun lampo di colore ---------------------- */
const m2 = JSON.parse((await provaCon({ accent: "indigo", density: "comfortable", reduceMotion: false })) || "{}");
check(
  "Accento indaco: applicato al primo fotogramma",
  m2.primo?.accento === "indigo",
  `primo=${m2.primo?.accento ?? "assente"} finale=${m2.dopo?.accento ?? "assente"}`,
);

/* --- 3. Valori predefiniti: nessun attributo, nessun salto ----------- */
const m3 = JSON.parse((await provaCon({ accent: "orange", density: "comfortable", reduceMotion: false })) || "{}");
check(
  "Valori predefiniti: nessun attributo e nessun cambiamento",
  m3.primo?.densita === null &&
    m3.primo?.accento === null &&
    m3.primo?.spacing === m3.dopo?.spacing,
  `${m3.primo?.spacing} -> ${m3.dopo?.spacing}`,
);

/* --- 4. Preferenza illeggibile: si ricade sui predefiniti ------------ */
await send("Page.navigate", { url: BASE });
await sleep(600);
await ev(`localStorage.setItem("office-prefs", "{ questo non e JSON")`);
await send("Page.navigate", { url: BASE });
await sleep(2000);
const rotto = JSON.parse((await ev("JSON.stringify(window.__misure)")) || "{}");
const titolo = await ev("document.title");
check(
  "Preferenza illeggibile: la pagina si disegna lo stesso",
  Boolean(rotto.primo) && typeof titolo === "string" && titolo.length > 0,
  `titolo="${titolo}" densita=${rotto.primo?.densita ?? "assente"}`,
);

await ev(`localStorage.removeItem("office-prefs")`);
console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
