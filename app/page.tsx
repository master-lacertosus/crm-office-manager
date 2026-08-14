import { redirect } from "next/navigation";

/* La home manda alla dashboard e basta: lo smistamento fra accesso e app lo
   fa già il proxy, che intercetta prima di arrivare qui. Chi non ha sessione
   non vede mai questo redirect — viene mandato al login con la destinazione
   in coda. */
export default function Home() {
  redirect("/dashboard");
}
