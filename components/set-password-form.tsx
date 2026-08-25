"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { messaggioErrore } from "@/lib/errori";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Otto caratteri è il minimo che Supabase impone per difetto. Chiederne di
 *  più senza spiegarlo produce solo tentativi rifiutati. */
const MIN = 8;

/**
 * Impostazione della password per chi arriva da un invito o da un recupero.
 *
 * Il caso delicato è il flusso implicito: il token viaggia nel frammento
 * dell'URL (`#access_token=…`), che il server non vede mai. Il client
 * Supabase del browser lo legge da solo all'avvio e crea la sessione, ma non
 * istantaneamente — per questo la pagina aspetta l'evento invece di
 * concludere subito che manca il permesso.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [conferma, setConferma] = React.useState("");
  /* Lo stato iniziale tiene già conto della configurazione: è nota al primo
     render, e deciderla in un effetto sarebbe un setState dentro useEffect —
     che il React Compiler rifiuta, a ragione. */
  const [stato, setStato] = React.useState<"attesa" | "pronto" | "assente">(
    isSupabaseConfigured ? "attesa" : "assente",
  );
  const [salvando, setSalvando] = React.useState(false);
  const [errore, setErrore] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let vivo = true;

    /* Due strade verso la stessa risposta: la sessione potrebbe esserci già
       (il link è passato dalla rotta /auth/confirm, che l'ha scritta nei
       cookie) oppure arrivare fra un istante, quando il client finisce di
       leggere il frammento dell'URL. */
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessione) => {
      if (vivo && sessione) setStato("pronto");
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      // Se non c'è sessione si attende comunque un momento: il frammento
      // viene letto all'avvio del client, non prima.
      if (data.session) setStato("pronto");
      else setTimeout(() => vivo && setStato((s) => (s === "attesa" ? "assente" : s)), 1500);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (password.length < MIN) {
      setErrore(`La password deve avere almeno ${MIN} caratteri.`);
      return;
    }
    if (password !== conferma) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setSalvando(true);
    setErrore(null);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      /* `refresh` prima di navigare: la sessione è appena cambiata e i
         componenti server devono rileggerla, altrimenti la dashboard si
         disegna con quella vecchia. */
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setErrore(
        messaggioErrore(err, "Impostazione non riuscita."),
      );
      setSalvando(false);
    }
  };

  if (stato === "attesa") {
    return (
      <div className="glass-strong flex items-center gap-2.5 rounded-2xl p-5 text-[13px] text-ink-secondary">
        <LoaderCircle className="size-4 animate-spin" />
        Verifica del link in corso…
      </div>
    );
  }

  if (stato === "assente") {
    return (
      <div className="glass-strong space-y-3 rounded-2xl p-5">
        <p className="flex items-start gap-2 text-[13px] text-ink">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden />
          Questo link non è valido o è scaduto.
        </p>
        <p className="text-[13px] text-ink-secondary">
          Chiedi a un responsabile di rimandarti l&rsquo;invito, oppure accedi
          normalmente se hai già una password.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/login">Vai all&rsquo;accesso</a>
        </Button>
      </div>
    );
  }

  return (
    <TiltCard>
      <form onSubmit={submit} className="glass-strong space-y-4 rounded-2xl p-5">
        <div>
          <h1 className="text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
            Scegli la tua password
          </h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Serve solo questa: da qui in poi entri con la tua email.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sp-password">Password</Label>
          <Input
            id="sp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN}
            autoFocus
            required
          />
          <p className="text-[11px] text-ink-muted">Almeno {MIN} caratteri.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sp-conferma">Ripeti la password</Label>
          <Input
            id="sp-conferma"
            type="password"
            value={conferma}
            onChange={(e) => setConferma(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {errore ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-text"
          >
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            {errore}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={salvando}
          aria-busy={salvando}
        >
          {salvando ? <LoaderCircle className="animate-spin" /> : null}
          Entra in Office OS
        </Button>
      </form>
    </TiltCard>
  );
}
