import type { Metadata } from "next";

import { TimbratureContent } from "@/components/timbrature-content";
import { Topbar } from "@/components/shell/topbar";

export const metadata: Metadata = { title: "Le mie ore" };

/**
 * Le proprie ore, mese per mese.
 *
 * Nessuna azione in barra: il gesto del timbrare vive nella pastiglia della
 * topbar, che è presente su ogni schermata. Qui si guarda e si corregge, che
 * sono due cose che si fanno stando fermi.
 */
export default function TimbraturePage() {
  return (
    <>
      <Topbar title="Le mie ore" />
      <TimbratureContent />
    </>
  );
}
