import type { Metadata } from "next";

import { Topbar } from "@/components/shell/topbar";
import { SondaggiContent } from "@/components/sondaggi/sondaggi-content";

export const metadata: Metadata = { title: "Sondaggi" };

/**
 * La pagina dei sondaggi.
 *
 * Nessuna azione nella barra: qui l'azione principale — lanciare — è un
 * modulo nella pagina, non un bottone che apre un dialogo. Un sondaggio si
 * scrive guardando l'anteprima di come lo vedranno gli altri, e quella non
 * sta in una tendina.
 */
export default function SondaggiPage() {
  return (
    <>
      <Topbar title="Sondaggi" />
      <SondaggiContent />
    </>
  );
}
