# Pubblicare su Vercel

Il repo `crm-office-manager` sta su un **account personale** (`master-lacertosus`),
non su un'organizzazione. Sui repo di un account personale le GitHub App le può
installare **solo il proprietario**: un collaboratore con permessi di push non
può, nemmeno se ha accesso completo al codice.

Servono quindi due passaggi, di due persone diverse.

---

## 1. Da inoltrare al proprietario dell'account `master-lacertosus`

> Ciao, per pubblicare online il gestionale (`crm-office-manager`) serve un tuo
> passaggio, perché il repo è sul tuo account personale e certe autorizzazioni
> può darle solo il proprietario.
>
> Ti chiedo di installare l'integrazione **Vercel** sul repo:
>
> 1. Vai su **https://github.com/apps/vercel** e premi **Configure**
> 2. Scegli l'account **master-lacertosus**
> 3. Seleziona **Only select repositories** e spunta **crm-office-manager**
> 4. Conferma
>
> Non serve creare account né inserire carte: l'installazione dà solo a Vercel
> il permesso di leggere quel repo per costruire il sito. Puoi revocarla quando
> vuoi dalla stessa pagina.
>
> Se preferisci non installare nulla, esiste un'alternativa: posso pubblicare
> dal mio computer con un comando, ma in quel caso ogni aggiornamento va
> lanciato a mano invece di partire da solo a ogni modifica.

---

## 2. Dopo l'installazione, sul progetto Vercel

Nella dashboard Vercel: **Add New → Project**, si sceglie
`master-lacertosus/crm-office-manager`. Next.js viene riconosciuto da solo,
nessuna configurazione di build da toccare.

Le **variabili d'ambiente** vanno aggiunte prima del primo deploy, in
*Settings → Environment Variables*, per tutti e tre gli ambienti (Production,
Preview, Development):

| Nome | Dove trovarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (chiave pubblicabile) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (chiave segreta) |

Le prime due finiscono nel bundle del browser ed è corretto così: da sole non
autorizzano nulla, decide la RLS. **La terza no**: bypassa la RLS e non va mai
prefissata con `NEXT_PUBLIC_`. Serve solo alla Server Action di invito.

## 3. Su Supabase, dopo il primo deploy

### URL di reindirizzo

**Authentication → URL Configuration**
(`https://supabase.com/dashboard/project/<ref>/auth/url-configuration`)

| Campo | Valore |
|---|---|
| Site URL | `https://<progetto>.vercel.app` |
| Redirect URLs | `http://localhost:3000/**` e `https://<progetto>.vercel.app/**` |

Il `/**` finale non è decorativo: senza, Supabase accetta solo quell'esatto
indirizzo e rifiuta ogni percorso sotto — compreso `/auth/confirm`, dove
atterrano tutti i link delle email. Per far funzionare anche le anteprime delle
pull request si aggiunge il carattere jolly che Vercel assegna ai deploy di
anteprima, nella forma `https://<progetto>-*-<scope>.vercel.app/**`.

### Template delle email (consigliato)

**Authentication → Email Templates**, modello *Invite user*. Il testo predefinito
usa `{{ .ConfirmationURL }}`, che passa dall'endpoint di verifica di Supabase e
consegna il token nel **frammento** dell'URL — che il server non vede mai.
Funziona lo stesso (la pagina lo legge dal browser), ma il percorso più solido è
puntare direttamente alla nostra rotta:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/imposta-password
```

Lo stesso vale per il modello *Reset password*, con `type=recovery`.

La rotta `app/auth/confirm/route.ts` gestisce comunque entrambe le forme: si può
lasciare il modello predefinito e cambiarlo più avanti.

### Mittente delle email

**Authentication → Emails → SMTP Settings**: configurare un mittente proprio. Il
mittente di prova di Supabase ha limiti molto stretti (poche email all'ora) ed è
pensato per lo sviluppo: con una squadra da invitare si esaurisce subito, e gli
inviti falliscono senza una ragione evidente per chi li manda.

## Ripiego senza GitHub

Se l'installazione dell'app non arriva, si pubblica dal locale:

```bash
npm i -g vercel
vercel login
vercel link
vercel --prod
```

Le variabili d'ambiente si impostano comunque dalla dashboard. Si perdono i
deploy automatici a ogni push e le anteprime sulle pull request.
