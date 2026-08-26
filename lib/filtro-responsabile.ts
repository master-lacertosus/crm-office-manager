import { eResponsabile } from "@/lib/permessi";
import type { Profile } from "@/lib/types";

/**
 * Chi si vede quando non si è chiesto niente.
 *
 * L'indirizzo senza `owner` significava «tutti», per chiunque. Su una board
 * condivisa è la scelta sbagliata per la maggior parte delle persone: un
 * dipendente apre il CRM per sapere cosa deve fare lui, e si trovava davanti
 * il lavoro di cinque colleghi da scremare a mano — ogni mattina, prima di
 * cominciare.
 *
 * Il panorama completo serve a chi deve sorvegliarlo. Quindi il valore
 * predefinito segue il ruolo:
 *
 *   - responsabile → tutti, che è il suo mestiere;
 *   - chiunque altro → i propri, che è la sua giornata.
 *
 * Nessuno perde niente: «Tutto il team» resta a un clic, e diventa un gesto
 * esplicito invece di uno stato di partenza.
 *
 * `all` come valore serve proprio a questo. Senza, un dipendente che sceglie
 * «Tutti i responsabili» produrrebbe un indirizzo senza `owner`, cioè
 * indistinguibile dal predefinito — e la scelta gli tornerebbe indietro
 * appena fatta.
 */

/** Valore che significa «tutti», scritto una volta sola. */
export const TUTTI = "all";

/**
 * Il responsabile su cui filtrare davvero.
 *
 * `null` vuol dire «nessun filtro»: si vedono tutti.
 */
export function responsabileEffettivo(
  parametro: string | null | undefined,
  utente: Pick<Profile, "id" | "role">,
): string | null {
  if (parametro === TUTTI) return null;
  if (parametro) return parametro;
  return eResponsabile(utente) ? null : utente.id;
}

/** Si sta guardando tutto il team? */
export function staVedendoTutti(
  parametro: string | null | undefined,
  utente: Pick<Profile, "id" | "role">,
): boolean {
  return responsabileEffettivo(parametro, utente) === null;
}

/** Il valore da mettere nell'indirizzo per vedere tutti, dato il ruolo.
 *  Per un responsabile «tutti» è già il predefinito, quindi l'indirizzo
 *  resta pulito; per gli altri serve dirlo. */
export function parametroPerTutti(
  utente: Pick<Profile, "id" | "role">,
): string | null {
  return eResponsabile(utente) ? null : TUTTI;
}
