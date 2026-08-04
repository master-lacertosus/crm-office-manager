/**
 * Navigazione «shallow» dello stato di vista (?task=, ?view=, filtri…):
 * l'URL si aggiorna con la History API nativa, che il router Next integra
 * (usePathname/useSearchParams restano sincronizzati) senza round-trip
 * RSC al server. In Next 16, su rotte statiche, router.replace scarterebbe
 * i parametri: questo modulo è l'unico posto che conosce la regola.
 * Solo per URL della stessa pagina; per cambiare pagina si usa <Link>.
 */

/** Patch di query string: valore nuovo, o null per rimuovere la chiave. */
export type SearchPatch = Record<string, string | null>;

/**
 * Applica una patch ai parametri correnti e naviga. Legge la sorgente di
 * verità (window.location) al momento della chiamata: i chiamanti non
 * devono iscriversi a useSearchParams solo per scrivere.
 */
export function updateSearch(
  patch: SearchPatch,
  { replace = false }: { replace?: boolean } = {},
): void {
  const params = new URLSearchParams(window.location.search);
  applyPatch(params, patch);
  const qs = params.toString();
  const url = qs ? `?${qs}` : window.location.pathname;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Naviga a un URL già pronto (es. una vista salvata: querystring intera). */
export function pushSearch(url: string): void {
  window.history.pushState(null, "", url);
}

/**
 * Href della pagina corrente con la patch applicata — per i SearchLink,
 * calcolato in render (mai da window: deve funzionare anche in prerender).
 */
export function hrefWith(
  pathname: string,
  current: URLSearchParams,
  patch: SearchPatch,
): string {
  const params = new URLSearchParams(current);
  applyPatch(params, patch);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function applyPatch(params: URLSearchParams, patch: SearchPatch): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
}
