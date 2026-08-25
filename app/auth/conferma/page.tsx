import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Conferma l'accesso" };

/**
 * Il token nel frammento, portato a mano alla pagina che sa leggerlo.
 *
 * Con i template predefiniti di Supabase il link non porta `token_hash` nella
 * query: porta un frammento `#access_token=…`. Il frammento non viaggia fino
 * al server — resta nel browser — quindi qui arriva un indirizzo che sembra
 * vuoto, e la pagina rispondeva «Link incompleto» a un link perfettamente
 * valido.
 *
 * Questo script sta nel documento e gira prima che si dipinga qualcosa: se
 * trova il frammento porta tutto alla pagina della password, che il client
 * Supabase sa gia' gestire. Se non lo trova non fa niente, e resta il
 * messaggio d'errore — che a quel punto e' vero.
 *
 * La destinazione e' gia' stata ridotta a un percorso interno prima di
 * arrivare qui, e passa da JSON.stringify: nel documento finisce una
 * stringa, non un pezzo di indirizzo da fidarsi.
 */
function saltaAlFrammento(destinazione: string): string {
  return `try{
var f=location.hash;
if(/(?:^|[#&])(access_token|refresh_token|error|error_description)=/.test(f)){
location.replace(${JSON.stringify(destinazione)}+f);
}
}catch(_){}`;
}

/**
 * Ultimo passo dei link mandati per email: un pulsante, e niente di più.
 *
 * Il motivo è che i link di Supabase valgono UNA volta sola, e i filtri
 * antivirus delle caselle aziendali (Safe Links di Microsoft 365 in testa)
 * aprono da soli gli indirizzi contenuti nelle email per controllarli.
 * Quell'apertura consuma il link: quando poi la persona clicca davvero, si
 * sente rispondere che è «scaduto». Succede in pochi secondi, prima ancora
 * che l'email compaia nella posta in arrivo.
 *
 * Qui il token non viene toccato: si consuma solo con l'invio del modulo,
 * cioè con un POST, che gli scanner non fanno. È la contromisura che
 * Supabase stessa documenta (Auth › Email Templates › Email prefetching).
 */
export default async function ConfermaPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
    redirect_to?: string;
  }>;
}) {
  const { token_hash, type, code, next, redirect_to } = await searchParams;

  /* Solo percorsi interni: `redirect_to` arriva dal template dell'email come
     indirizzo assoluto, ma quello che serve è la parte finale. */
  const grezzo = next ?? percorsoDi(redirect_to);
  const destinazione =
    grezzo && grezzo.startsWith("/") && !grezzo.startsWith("//")
      ? grezzo
      : "/auth/imposta-password";

  /* Flusso PKCE: il link porta `code` invece di `token_hash`. Non e' un
     link rotto, e' un'altra forma — la rotta /auth/confirm sa scambiarlo
     con una sessione. Qui non serve il pulsante contro gli scanner: un
     `code` che venisse consumato da uno scanner darebbe un errore chiaro,
     mentre lasciare la persona davanti a «Link incompleto» non aiuta
     nessuno. */
  if (code) {
    redirect(
      `/auth/confirm?code=${encodeURIComponent(code)}&next=${encodeURIComponent(destinazione)}`,
    );
  }

  const valido = Boolean(token_hash && type);

  return (
    <main className="grid min-h-dvh flex-1 place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Image
            src="/lacertosus-logo.svg"
            alt="Lacertosus"
            width={850}
            height={96}
            priority
            unoptimized
            className="h-[18px] w-auto"
          />
          <p className="mt-2 font-mono text-[11px] text-ink-muted">Office OS</p>
        </div>

        {valido ? (
          <form
            method="post"
            action="/auth/confirm"
            className="glass-strong space-y-4 rounded-2xl p-5"
          >
            <div>
              <h1 className="flex items-center gap-2 text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
                <MailCheck aria-hidden className="size-4 text-brand-600" />
                Ci siamo quasi
              </h1>
              <p className="mt-1 text-[13px] text-ink-secondary">
                Conferma di essere tu: al passo dopo sceglierai la password.
              </p>
            </div>

            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={destinazione} />

            <Button type="submit" size="lg" className="w-full">
              Continua
            </Button>
          </form>
        ) : (
          <div className="glass-strong space-y-3 rounded-2xl p-5">
            {/* Prima di dare per rotto il link: il codice potrebbe essere nel
                frammento, che il server non vede. Lo script gira subito e, se
                lo trova, porta tutto alla pagina della password. */}
            <script
              dangerouslySetInnerHTML={{
                __html: saltaAlFrammento(destinazione),
              }}
            />
            <h1 className="flex items-center gap-2 text-[17px]/6 font-semibold tracking-[-0.008em] text-ink">
              <TriangleAlert aria-hidden className="size-4 text-danger-text" />
              Link incompleto
            </h1>
            <p className="text-[13px] text-ink-secondary">
              Questo indirizzo non porta con sé il codice di conferma: può
              succedere se l&rsquo;email è stata inoltrata o se il link si è
              spezzato nel messaggio. Chiedine uno nuovo dalla pagina di
              accesso.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login?recupero=1">Richiedi un link nuovo</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

/** Da «https://esempio.it/auth/imposta-password» a «/auth/imposta-password». */
function percorsoDi(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return undefined;
  }
}
