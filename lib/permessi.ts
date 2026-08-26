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
  /** Lavoro padre: chi lo guida governa anche i suoi pezzi. */
  parent_id?: string | null;
}

/** I responsabili del workspace: approvano, decidono, governano. */
export function eResponsabile(utente: UtenteMinimo): boolean {
  return utente.role === "admin";
}

/**
 * Un progetto nasce per mano di un responsabile.
 * Specchio di `projects_insert_admin` (M9).
 *
 * Serve a non offrire quello che il database rifiuterebbe: un pulsante
 * «crea progetto» mostrato a chi non può usarlo è una porta che si apre
 * con un no.
 */
export function puoCreareProgetto(utente: UtenteMinimo): boolean {
  return eResponsabile(utente);
}

/**
 * Un task lo lavora chi ne risponde: il responsabile, chi l'ha creato, i
 * collaboratori — e il referente del lavoro padre, perché chi guida un
 * lavoro deve poterne organizzare i pezzi.
 * Specchio di `public.puo_modificare_task()` (M9, esteso da M10).
 */
export function puoModificareTask(
  task: TaskMinimo,
  utente: UtenteMinimo,
  /** Il lavoro padre, quando il task è un pezzo. */
  padre?: TaskMinimo | null,
): boolean {
  if (eResponsabile(utente)) return true;
  return (
    task.owner_id === utente.id ||
    task.created_by === utente.id ||
    (task.collaborators ?? []).includes(utente.id) ||
    padre?.owner_id === utente.id
  );
}

/**
 * Chi può aggiungere un pezzo a un lavoro e affidarlo a un collega: i
 * responsabili sempre, il referente del lavoro dentro il proprio perimetro.
 * Assegnare lavoro fuori da qui resta un atto di governo, e per proporlo
 * ci sono le Richieste.
 */
export function puoAggiungereSottoTask(
  padre: TaskMinimo,
  utente: UtenteMinimo,
): boolean {
  return eResponsabile(utente) || padre.owner_id === utente.id;
}

/** Assegnare lavoro ad altri è dei responsabili: per proporlo ci sono le
 *  Richieste, che passano da un'approvazione. */
export const puoAssegnareAdAltri = eResponsabile;

/** I progetti sono struttura, non lavoro quotidiano. */
export const puoGestireProgetti = eResponsabile;

/** Lanciare un template significa creare task per altri: stessa regola. */
export const puoLanciareTemplate = eResponsabile;
