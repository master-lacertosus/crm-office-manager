import { redirect } from "next/navigation";

// Fase placeholder: la home porta alla dashboard. Con l'autenticazione
// reale (Supabase) il middleware smisterà tra /login e /dashboard.
export default function Home() {
  redirect("/dashboard");
}
