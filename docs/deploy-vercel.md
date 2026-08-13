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

**Authentication → URL Configuration**: aggiungere il dominio Vercel a *Site URL*
e a *Redirect URLs*. Senza, i link delle email di invito e di recupero password
rimandano a `localhost` e non funzionano per nessuno.

**Authentication → Emails → SMTP Settings**: configurare un mittente proprio. Il
mittente di prova di Supabase ha limiti molto stretti (poche email all'ora) ed è
pensato per lo sviluppo: con una squadra da invitare si esaurisce subito.

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
