import { ScheletroElenco } from "@/components/scheletro-elenco";

/**
 * Cosa si vede mentre il progetto arriva.
 *
 * Questa pagina e' dinamica per una ragione buona: il progetto lo legge il
 * server con la sessione di chi chiede, cosi' la RLS decide se esiste o se
 * non gli spetta -- e non si rivela la differenza. Ma finche' quella lettura
 * non torna, senza questo file il browser resta sull'elenco dei progetti, e
 * premere una scheda sembra non fare niente.
 *
 * Il titolo non si puo' indovinare: e' il nome del progetto, e lo sa solo il
 * server. Quindi qui NON si disegna una Topbar con un titolo finto, che
 * verrebbe sostituito un istante dopo -- si lascia il posto vuoto e si mostra
 * la forma del contenuto.
 */
export default function ProgettoLoading() {
  return <ScheletroElenco righe={6} />;
}
