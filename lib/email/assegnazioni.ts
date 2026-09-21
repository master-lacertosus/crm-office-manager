/**
 * La mail che annuncia il lavoro appena assegnato.
 *
 * Qui non si spedisce e non si legge il database: si decide soltanto CHE
 * COSA dire, a partire da dati già raccolti. È l'unico pezzo che si può
 * provare senza rete, ed è anche quello che sbaglia più facilmente — il
 * testo di una mail lo si scrive una volta e lo leggono in sei, ogni volta.
 *
 * La regola che governa tutto il file: una mail che si può ignorare senza
 * perdere niente insegna a ignorare anche le successive. Quindi l'oggetto
 * dice il lavoro, non la categoria della notifica: «Ti è stata assegnata una
 * nuova task» è identico ogni volta e dopo tre invii diventa invisibile,
 * mentre «Da Francesco: Rifare la scheda prodotto — entro il 24/09» si legge
 * dall'anteprima e spesso non ha nemmeno bisogno di essere aperta.
 */

import { formatDue } from "@/lib/format";

/** Un lavoro arrivato, ridotto a ciò che serve per scriverne. */
export interface LavoroArrivato {
  taskId: string;
  titolo: string;
  /** Chi l'ha assegnato. `null` = nessun mittente umano (lavoro pianificato). */
  daChi: string | null;
  /** ISO `YYYY-MM-DD`, o `null` se nessuno ha detto quando serve. */
  scadenza: string | null;
  progetto: string | null;
  priorita: "low" | "normal" | "high";
}

export interface MailComposta {
  oggetto: string;
  testo: string;
  html: string;
}

/** «Francesco Salafia» → «Francesco». In una mail fra colleghi il cognome è
 *  burocrazia: si scrivono così anche gli avvisi in app. */
function nomeDiBattesimo(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Chi ha consegnato il lavoro, quando sono tutti la stessa persona. */
function mittenteComune(lavori: readonly LavoroArrivato[]): string | null {
  const primi = lavori[0]?.daChi ?? null;
  if (!primi) return null;
  return lavori.every((l) => l.daChi === primi) ? nomeDiBattesimo(primi) : null;
}

/** «entro il 24/09», oppure niente se nessuno ha detto quando. */
function quando(scadenza: string | null): string {
  return scadenza ? `entro il ${formatDue(scadenza)}` : "";
}

/**
 * L'oggetto della mail.
 *
 * Un lavoro solo: si dice quale, da chi e per quando — tutto quello che
 * serve per decidere se aprire adesso o dopo pranzo, senza aprire niente.
 * Più lavori: si dice quanti e da chi, perché sei titoli in un oggetto non
 * si leggono.
 */
export function oggettoDi(lavori: readonly LavoroArrivato[]): string {
  const da = mittenteComune(lavori);
  if (lavori.length === 1) {
    const l = lavori[0];
    const coda = quando(l.scadenza);
    return [
      da ? `Da ${da}: ${l.titolo}` : l.titolo,
      coda ? ` — ${coda}` : "",
    ].join("");
  }
  return da
    ? `${lavori.length} lavori nuovi da ${da}`
    : `${lavori.length} lavori nuovi per te`;
}

/** Una riga di elenco, in chiaro. */
function rigaTesto(l: LavoroArrivato): string {
  const dettagli = [
    l.progetto,
    quando(l.scadenza),
    l.priorita === "high" ? "priorità alta" : null,
  ].filter(Boolean);
  return `• ${l.titolo}${dettagli.length ? ` (${dettagli.join(" · ")})` : ""}`;
}

/**
 * Il corpo in chiaro.
 *
 * Non è un ripiego per client antiquati: è la versione che si legge
 * nell'anteprima del telefono prima di decidere se aprire, ed è quella che
 * sopravvive quando le immagini sono bloccate — cioè quasi sempre, in una
 * casella aziendale.
 */
export function testoDi(
  lavori: readonly LavoroArrivato[],
  destinatarioNome: string,
  base: string,
): string {
  const uno = lavori.length === 1;
  const da = mittenteComune(lavori);
  const apertura = uno
    ? da
      ? `${da} ti ha assegnato un lavoro.`
      : `Ti è stato assegnato un lavoro.`
    : da
      ? `${da} ti ha assegnato ${lavori.length} lavori.`
      : `Ti sono stati assegnati ${lavori.length} lavori.`;

  const elenco = lavori.map(rigaTesto).join("\n");
  const link = uno
    ? `${base}/tasks?task=${lavori[0].taskId}`
    : `${base}/tasks`;

  return [
    `Ciao ${nomeDiBattesimo(destinatarioNome)},`,
    "",
    apertura,
    "",
    elenco,
    "",
    uno ? `Aprilo qui: ${link}` : `Guardali qui: ${link}`,
    "",
    "—",
    "Lacertosus Office OS",
    `Per non ricevere più queste email: ${base}/settings/appearance`,
  ].join("\n");
}

/** Scappa il testo che finisce dentro l'HTML. Nessuna libreria: sono cinque
 *  sostituzioni, e una dipendenza per questo non si giustifica. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Il corpo HTML.
 *
 * Stili in linea e tabelle no: niente classi, niente `<style>` in testa —
 * le caselle aziendali li tolgono. Si resta su un impianto sobrio che regge
 * anche quando il client ignora metà del CSS, invece di una grafica che si
 * sfascia su Outlook. L'arancione compare una volta sola, sul pulsante:
 * è la stessa regola dell'app.
 */
export function htmlDi(
  lavori: readonly LavoroArrivato[],
  destinatarioNome: string,
  base: string,
): string {
  const uno = lavori.length === 1;
  const da = mittenteComune(lavori);
  const apertura = uno
    ? da
      ? `<strong>${esc(da)}</strong> ti ha assegnato un lavoro.`
      : "Ti è stato assegnato un lavoro."
    : da
      ? `<strong>${esc(da)}</strong> ti ha assegnato ${lavori.length} lavori.`
      : `Ti sono stati assegnati ${lavori.length} lavori.`;

  const righe = lavori
    .map((l) => {
      const dettagli = [
        l.progetto ? esc(l.progetto) : null,
        quando(l.scadenza),
        l.priorita === "high" ? "priorità alta" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return [
        `<tr><td style="padding:10px 0;border-bottom:1px solid #E3E5E8;">`,
        `<div style="font-size:15px;font-weight:600;color:#14171A;">${esc(l.titolo)}</div>`,
        dettagli
          ? `<div style="font-size:13px;color:#696E76;margin-top:2px;">${dettagli}</div>`
          : "",
        `</td></tr>`,
      ].join("");
    })
    .join("");

  const link = uno ? `${base}/tasks?task=${lavori[0].taskId}` : `${base}/tasks`;

  return `<!doctype html>
<html lang="it"><body style="margin:0;padding:24px;background:#F7F7F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:24px;">
<tr><td>
<p style="margin:0 0 16px;font-size:15px;color:#14171A;">Ciao ${esc(nomeDiBattesimo(destinatarioNome))},</p>
<p style="margin:0 0 16px;font-size:15px;color:#14171A;">${apertura}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${righe}</table>
<p style="margin:24px 0 0;">
<a href="${esc(link)}" style="display:inline-block;background:#FF6B00;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">${uno ? "Apri il lavoro" : "Guarda i lavori"}</a>
</p>
<p style="margin:24px 0 0;font-size:12px;color:#696E76;border-top:1px solid #E3E5E8;padding-top:16px;">
Lacertosus Office OS · <a href="${esc(base)}/settings/appearance" style="color:#696E76;">non ricevere più queste email</a>
</p>
</td></tr></table>
</body></html>`;
}

/** Tutto insieme: l'unica funzione che serve a chi spedisce. */
export function componiMail(
  lavori: readonly LavoroArrivato[],
  destinatarioNome: string,
  base: string,
): MailComposta {
  return {
    oggetto: oggettoDi(lavori),
    testo: testoDi(lavori, destinatarioNome, base),
    html: htmlDi(lavori, destinatarioNome, base),
  };
}
