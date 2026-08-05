/**
 * Verifica end-to-end foto profilo: upload dal form Impostazioni (CDP
 * DOM.setFileInputFiles), resa nel form e in sidebar, persistenza al
 * reload, resa cross-pagina (team), rimozione. Stampa PASS/FAIL.
 */
const PORT = 9223;
const FILE = process.env.TEMP + "\\avatar-test.png";
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
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`TIMEOUT ${method}`)); } }, 20_000);
  });
}
async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { evalError: r.result.exceptionDetails.text };
  return r.result?.result?.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Runtime.enable");
await send("Page.enable");

/* 1. Vai al profilo e carica il file nell'input nascosto */
await ev(`location.href = 'http://localhost:3000/settings/profile'; true`);
await sleep(3000);

const doc = await send("DOM.getDocument");
const input = await send("DOM.querySelector", {
  nodeId: doc.result.root.nodeId,
  selector: 'input[type="file"][accept="image/*"]',
});
check("Input file presente nel form", input.result.nodeId > 0);
await send("DOM.setFileInputFiles", {
  files: [FILE],
  nodeId: input.result.nodeId,
});
await sleep(1500);

const afterUpload = await ev(`(() => {
  const form = document.querySelector('form');
  const img = form?.querySelector('span[title] img');
  const stored = localStorage.getItem('profile-avatars');
  const parsed = stored ? JSON.parse(stored) : {};
  const ids = Object.keys(parsed);
  return {
    formImg: !!img,
    imgIsDataUrl: img?.src.startsWith('data:image/jpeg') ?? false,
    toast: document.body.textContent.includes('Foto del profilo aggiornata'),
    storedCount: ids.length,
    storedBytes: stored?.length ?? 0,
    removeBtn: [...form.querySelectorAll('button')].some((b) => b.textContent.includes('Rimuovi')),
    changeLabel: [...form.querySelectorAll('button')].some((b) => b.textContent.includes('Cambia foto')),
  };
})()`);
check("Foto resa nel form (img data URL)", afterUpload.formImg && afterUpload.imgIsDataUrl, JSON.stringify(afterUpload));
check("Toast di conferma mostrato", afterUpload.toast === true);
check("Salvata in localStorage (profile-avatars)", afterUpload.storedCount === 1 && afterUpload.storedBytes > 500, `${afterUpload.storedBytes} byte`);
check("Bottoni «Cambia foto» e «Rimuovi» presenti", afterUpload.removeBtn && afterUpload.changeLabel);

const sidebarImg = await ev(`!!document.querySelector('aside span[title] img, nav span[title] img') || document.querySelectorAll('img[src^="data:image/jpeg"]').length >= 2`);
check("Foto anche in sidebar (utente corrente)", sidebarImg === true, String(sidebarImg));

/* 2. Reload: la foto persiste */
await ev(`location.reload(); true`);
await sleep(2500);
const afterReload = await ev(`(() => {
  const img = document.querySelector('form span[title] img');
  return { formImg: !!img, isData: img?.src.startsWith('data:image/jpeg') ?? false };
})()`);
check("Persistenza: foto presente dopo reload", afterReload.formImg && afterReload.isData, JSON.stringify(afterReload));

/* 3. Cross-pagina: la foto compare nella pagina Team */
await ev(`location.href = 'http://localhost:3000/team'; true`);
await sleep(2500);
const teamImgs = await ev(`document.querySelectorAll('img[src^="data:image/jpeg"]').length`);
check("Team: la foto compare anche lì", teamImgs >= 1, `${teamImgs} img`);

/* 4. Rimozione: si torna alle iniziali */
await ev(`location.href = 'http://localhost:3000/settings/profile'; true`);
await sleep(2500);
await ev(`[...document.querySelectorAll('form button')].find((b) => b.textContent.includes('Rimuovi'))?.click(); true`);
await sleep(800);
const afterRemove = await ev(`(() => {
  const img = document.querySelector('form span[title] img');
  const stored = localStorage.getItem('profile-avatars');
  return {
    formImg: !!img,
    storedEmpty: !stored || stored === '{}',
    toast: document.body.textContent.includes('Foto rimossa'),
  };
})()`);
check("Rimozione: si torna alle iniziali", afterRemove.formImg === false && afterRemove.storedEmpty, JSON.stringify(afterRemove));
check("Toast di rimozione mostrato", afterRemove.toast === true);

console.log(`\n[eccezioni] ${JSON.stringify(exceptions)}`);
console.log(failures === 0 ? "\nTUTTO VERDE" : `\n${failures} CONTROLLI FALLITI`);
ws.close();
process.exit(failures === 0 ? 0 : 1);

