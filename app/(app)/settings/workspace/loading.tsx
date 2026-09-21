/**
 * Cosa si vede mentre il cancello decide.
 *
 * Workspace e' una delle due sole pagine DINAMICHE del prodotto (l'altra e'
 * Team): prima di disegnare, il server verifica sul database che tu sia un
 * responsabile. Senza questo file Next non ha niente da mostrare durante quel
 * giro, e il browser resta fermo sulla scheda precedente -- che si legge come
 * un link rotto, non come un'attesa.
 *
 * Qui non si ridisegna la Topbar: la mette gia' il layout di Impostazioni.
 */
export default function WorkspaceLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Caricamento in corso">
      <div className="card-soft space-y-2 p-4">
        <span aria-hidden className="skeleton block h-3.5 w-24" />
        <span aria-hidden className="skeleton block h-4 w-64 max-w-full" />
        <span aria-hidden className="skeleton mt-3 block h-8 w-52 max-w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-soft space-y-2 p-4">
          <span aria-hidden className="skeleton block h-3.5 w-40" />
          <span aria-hidden className="skeleton block h-3 w-full" />
          <span aria-hidden className="skeleton block h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
