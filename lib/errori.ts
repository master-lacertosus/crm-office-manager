/**
 * Il motivo vero di una scrittura fallita.
 *
 * Il database lo dice sempre — «violates foreign key constraint», «new row
 * violates row-level security policy» — ma quel messaggio arriva in forme
 * diverse a seconda di chi lo lancia, e finora bastava una forma inattesa
 * per sostituirlo con un generico «salvataggio non riuscito»: l'utente
 * vedeva che qualcosa era andato storto senza poter sapere cosa, e chi
 * doveva ripararlo nemmeno.
 *
 * Qui si accetta qualunque forma e si tiene il codice dell'errore quando
 * c'è: `23503` dice «manca la riga a cui questa punta», `42501` dice «la
 * policy non te lo permette». Sono due problemi opposti, e distinguerli è
 * la differenza fra capire e indovinare.
 */

interface ErroreConMessaggio {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

export function messaggioErrore(errore: unknown, ripiego: string): string {
  const parti: string[] = [];

  if (typeof errore === "string" && errore.trim()) {
    parti.push(errore.trim());
  } else if (errore && typeof errore === "object") {
    const e = errore as ErroreConMessaggio;
    if (typeof e.message === "string" && e.message.trim()) {
      parti.push(e.message.trim());
    }
    // I dettagli spiegano QUALE riga o vincolo: senza, «violates foreign key
    // constraint» non dice su cosa.
    if (typeof e.details === "string" && e.details.trim()) {
      parti.push(e.details.trim());
    }
    if (typeof e.hint === "string" && e.hint.trim()) {
      parti.push(e.hint.trim());
    }
    if (typeof e.code === "string" && e.code.trim()) {
      parti.push(`[${e.code.trim()}]`);
    }
  }

  return parti.length > 0 ? parti.join(" · ") : ripiego;
}
