import { ScheletroElenco } from "@/components/scheletro-elenco";
import { Topbar } from "@/components/shell/topbar";

/**
 * Cosa si vede mentre il cancello decide.
 *
 * Team e' una delle due sole pagine DINAMICHE del prodotto (l'altra e'
 * Workspace): prima di disegnare qualunque cosa, il server verifica sul
 * database che tu sia un responsabile -- le email e i carichi di tutti non
 * devono arrivare al browser di chi non li puo' vedere.
 *
 * Il costo di quella verifica e' un giro fino a Supabase, e senza questo file
 * Next non ha niente da mostrare nel frattempo: il browser resta fermo sulla
 * pagina da cui sei partito, e premere «Team» sembra non fare niente. Le
 * altre nove pagine sono statiche e si aprono all'istante, quindi la
 * differenza non si legge come «questa e' piu' lenta» ma come «questa e'
 * rotta».
 */
export default function TeamLoading() {
  return (
    <>
      <Topbar title="Team" />
      <ScheletroElenco righe={5} />
    </>
  );
}
