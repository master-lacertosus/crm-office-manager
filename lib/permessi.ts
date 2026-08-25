/**
 * Chi può fare cosa, lato interfaccia.
 *
 * Il confine vero è nel database (migrazione M9): qui si decide solo cosa
 * mostrare, perché offrire un pulsante che il database rifiuterà è peggio
 * che non offrirlo. Le due regole devono restare uguali — se cambia una,
 * cambia l'altra.
 *
 * Nessun import di proposito: così la regola si può provare con uno script,
 * senza tirarsi dietro React.
 */

export interface UtenteMinimo {
  id: string;
  role: string;
}

export interface TaskMinimo {
  owner_id: string;
  created_by: string;
  collaborators?: string[];
}

/** I responsabili del workspace: approvano, decidono, governano. */
export function eResponsabile(utente: UtenteMinimo): boolean {
  return utente.role === "admin";
}

/**
 * Un task lo lavora chi ne risponde: il responsabile, chi l'ha creato, i
 * collaboratori. Gli altri leggono e commentano.
 * Specchio di `public.puo_modificare_task()` in M9.
 */
export function puoModificareTask(
  task: TaskMinimo,
  utente: UtenteMinimo,
): boolean {
  if (eResponsabile(utente)) return true;
  return (
    task.owner_id === utente.id ||
    task.created_by === utente.id ||
    (task.collaborators ?? []).includes(utente.id)
  );
}

/** Assegnare lavoro ad altri è dei responsabili: per proporlo ci sono le
 *  Richieste, che passano da un'approvazione. */
export const puoAssegnareAdAltri = eResponsabile;

/** I progetti sono struttura, non lavoro quotidiano. */
export const puoGestireProgetti = eResponsabile;

/** Lanciare un template significa creare task per altri: stessa regola. */
export const puoLanciareTemplate = eResponsabile;
