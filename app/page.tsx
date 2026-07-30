import { redirect } from "next/navigation";

// Provvisorio: finché non esiste la dashboard (M6), la home porta alla
// pagina di verifica del design system.
export default function Home() {
  redirect("/styleguide");
}
