# Inviti e accesso — configurazione di Supabase

> Le impostazioni che vivono nel dashboard di Supabase e **non** nel codice.
> Se un invito «risulta scaduto» appena arriva, la causa è quasi sempre qui.

## Il problema che questa pagina risolve

I link mandati per email da Supabase valgono **una volta sola**. I filtri
antivirus delle caselle aziendali — Safe Links di Microsoft 365 in testa, ma
anche molti antispam — **aprono da soli** gli indirizzi contenuti nei messaggi
per controllarli. Quell'apertura consuma il link: quando la persona clicca
davvero, si sente rispondere che è «scaduto». Succede in pochi secondi, spesso
prima che l'email compaia nella posta in arrivo.

È un comportamento noto e documentato da Supabase
([Email Templates › Email prefetching](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching)):
la contromisura è non far consumare il token dal link, ma da un **pulsante**
su una nostra pagina. L'app la espone su `/auth/conferma`.

La seconda causa, più banale, è la **durata**: se il link vale un'ora e il
collega apre l'email dopo pranzo, è scaduto per davvero.

## 1. Template delle email

Dashboard → **Authentication › Email Templates**. Per ogni template sostituire
il link a `{{ .ConfirmationURL }}` con uno che punta alla nostra pagina,
cambiando solo il valore di `type`:

| Template | `type` |
|---|---|
| Invite user | `invite` |
| Reset password | `recovery` |
| Confirm signup | `signup` |
| Magic link | `magiclink` |

**Invite user** (gli altri sono identici a meno del `type`):

```html
<h2>Ti hanno invitato su Lacertosus Office OS</h2>
<p>
  Ciao {{ .Data.full_name }}, il tuo accesso è pronto: scegli una password e
  puoi entrare.
</p>
<p>
  <a href="{{ .SiteURL }}/auth/conferma?token_hash={{ .TokenHash }}&type=invite&next=/auth/imposta-password">
    Attiva il tuo accesso
  </a>
</p>
<p>Se non ti aspettavi questa email, puoi ignorarla.</p>
```

Perché funziona: `{{ .TokenHash }}` viaggia **senza essere consumato**; la
pagina lo tiene in un modulo e lo verifica solo quando qualcuno preme
«Continua». Gli scanner aprono i link (GET), non inviano i moduli (POST).

## 2. Durata dei link

Dashboard → **Authentication › Providers › Email**, voce **Email OTP
Expiration**.

- Per gli inviti conviene **86400** (24 ore): una persona invitata di mattina
  può attivarsi la sera.
- Supabase consiglia di non superare l'ora per i codici usa e getta: se si
  preferisce restare a **3600**, va bene lo stesso — con il pulsante di
  conferma il link non si brucia più da solo, e chi arriva tardi trova la
  pagina di recupero già pronta invece di un vicolo cieco.

## 3. Indirizzi di ritorno

**Il dominio di produzione, oggi, è `https://lct-ufficio.vercel.app`.**
Verificato: risponde l'app, `/auth/conferma` è raggiungibile e non c'è
Deployment Protection di mezzo.

Se un giorno passa a un dominio proprio, il valore da usare è quello che
Vercel → il progetto → **Domains** marca *Production*, copiato com'è. Non
dedurlo dal nome dell'azienda: sbagliare questo campo non dà nessun errore
visibile — le email partono, arrivano, e il link dentro punta a un
indirizzo che non esiste. Chi ci clicca vede una pagina che non si apre,
indistinguibile da un invito scaduto.

Dashboard → **Authentication › URL Configuration**:

- **Site URL**: `https://lct-ufficio.vercel.app`
  È la base di `{{ .SiteURL }}` nei template: tutti i link delle email
  nascono da qui.
- **Redirect URLs**: `https://lct-ufficio.vercel.app/**` e, per provare
  dalle anteprime, `https://*.vercel.app/**`.

Il secondo non è un di più: se l'indirizzo di ritorno non è nella lista,
Supabase lo scarta in silenzio e rimanda alla Site URL. Il link funziona
lo stesso, ma porta alla pagina sbagliata.

Controprova in dieci secondi: apri `https://lct-ufficio.vercel.app/auth/conferma`
in una scheda. Deve rispondere la pagina dell'app — se compare un login di
**Vercel**, quel dominio ha la Deployment Protection attiva e nessun
invitato riuscirà a passare; va tolta per la produzione (Vercel → Settings
› Deployment Protection).

Nota su come l'app costruisce il link: l'indirizzo di ritorno lo ricava
dalla richiesta in corso (`host`), non da una variabile d'ambiente. Quindi
un invito mandato mentre si naviga su un'anteprima punta all'anteprima —
per il team, gli inviti si mandano dal dominio di produzione.

## 4. Se si usa un SMTP proprio

Dashboard → **Authentication › Emails › SMTP Settings**. Disattivare il **link
tracking** del fornitore (SendGrid, Brevo, Mailgun…): riscrive gli indirizzi
per contare i clic e rompe i link di Supabase, che poi risultano non validi.

## Cosa fa l'app, dal canto suo

- `/auth/conferma` — pagina con il pulsante: il token si consuma solo qui, con
  un POST.
- `/auth/confirm` — la rotta che verifica. Accetta ancora i GET dei formati
  storici (`token_hash`, `code`, frammento `#access_token`), così i link già
  mandati continuano a funzionare.
- Se il link è scaduto o già usato, si torna alla pagina di accesso con il
  **modulo di recupero già aperto** e il motivo spiegato: chi è rimasto fuori
  si rimanda il link da solo, senza chiedere niente a nessuno.
- Un responsabile può comunque rimandarlo da **Team › Rimanda il link**.

## Prova rapida dopo una modifica

1. Invita un indirizzo di prova (meglio se su una casella aziendale, dove gli
   scanner sono attivi).
2. Apri l'email e **guarda il link prima di cliccarlo**: deve puntare a
   `…/auth/conferma?token_hash=…` sul dominio di produzione, quello vero.
   Se il dominio è un altro, il problema è la **Site URL** del punto 3 e non
   serve andare avanti — nessun clic funzionerà finché resta così.
3. Aspetta qualche minuto — il tempo che gli scanner facciano il loro giro —
   poi clicca: deve comparire «Ci siamo quasi» e, dopo «Continua», la pagina
   della password.

Se al passo 3 compare un login di **Vercel** invece della pagina dell'app, il
token è a posto: è la Deployment Protection a fermare tutto, e va tolta per la
produzione.
