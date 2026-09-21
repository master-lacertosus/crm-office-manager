# Email dei lavori assegnati — accensione

Tre passaggi, una volta sola. Finché non sono fatti tutti e tre, l'app
funziona esattamente come prima: la rotta risponde e non manda niente,
nessun errore nei log.

---

## Come funziona, in una riga

Il trigger di **M14** scrive già una riga in `notifications` a ogni
assegnazione. **M15** aggiunge un lavoro pianificato che ogni cinque minuti
guarda se c'è qualcosa da spedire e, se sì, bussa alla rotta
`/api/avvisi-email` dell'app. La rotta legge, raggruppa per destinatario,
compone e spedisce con Resend.

Il database fa l'unica cosa che l'app non sa fare da sola — svegliarsi a
orario — e per il resto suona un campanello. Il testo della mail vive in
TypeScript (`lib/email/assegnazioni.ts`), dove si può ritoccare senza una
migrazione e si può provare senza rete.

```
tasks  ──trigger M14──▶  notifications
                              │
                    pg_cron ogni 5 min
                              │
                      sveglia_invio_email()
                              │  net.http_post + segreto
                              ▼
                   POST /api/avvisi-email        (Vercel)
                              │  raggruppa per persona
                              ▼
                   api.resend.com/emails
```

---

## Passo 1 — Resend

1. Crea un account su **resend.com** (il piano gratuito basta: 3.000 email al
   mese, e qui se ne mandano dell'ordine di una al giorno).
2. **Domains → Add Domain**. Consiglio un sottodominio dedicato, per esempio
   `notifiche.lacertosus.com`: se un giorno qualcosa va storto, la
   reputazione della posta principale dell'azienda non ne risente.
3. Resend mostra dei record DNS (DKIM e return-path) da aggiungere dove è
   gestito `lacertosus.com`. Vanno aggiunti **tutti**, poi si preme *Verify*.

   Nota: l'SPF del dominio include già `spf.turbo-smtp.com` e
   `_spf.google.com`. Aggiungere un sottodominio dedicato non tocca quella
   riga, che è un'altra ragione per preferirlo.
4. **API Keys → Create**, permesso *Sending access*. La chiave si vede una
   volta sola: copiala subito.

Finché il dominio non risulta verificato, Resend rifiuta gli invii verso
indirizzi diversi dal proprio. È il motivo per cui questo passo viene prima
degli altri due.

---

## Passo 2 — Supabase

1. **SQL Editor** → incolla `supabase/migrations/20260921120000_m15_email_assegnazioni.sql`
   → *Run*. È idempotente: si può rieseguire.

   Leggi le righe `NOTICE`/`WARNING` che escono. Se dicono che `pg_net` o
   `pg_cron` non sono disponibili, attivali da **Database → Extensions** e
   riesegui il file. Il resto della migrazione è comunque già applicato.

2. Sempre nell'SQL Editor, la riga di configurazione — **non** sta nel file
   della migrazione perché contiene un segreto e quel file finisce su GitHub:

   ```sql
   insert into public.impostazioni_invio (id, base_url, segreto)
   values (true, 'https://lct-ufficio.vercel.app', 'IL-SEGRETO')
   on conflict (id) do update
     set base_url = excluded.base_url,
         segreto  = excluded.segreto,
         aggiornato_at = now();
   ```

   Il segreto va generato una volta e usato **identico** anche nel passo 3:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

---

## Passo 3 — Vercel

**Project → Settings → Environment Variables**, tutte e quattro su
*Production* (e *Preview*, se vuoi provarle lì):

| Variabile | Valore |
|---|---|
| `RESEND_API_KEY` | la chiave del passo 1 |
| `MITTENTE_EMAIL` | `Lacertosus Office <avvisi@notifiche.lacertosus.com>` |
| `SEGRETO_INVIO_EMAIL` | lo **stesso** segreto del passo 2 |
| `BASE_URL_APP` | `https://lct-ufficio.vercel.app` |

Poi **Redeploy**: le variabili non entrano in un deploy già fatto.

---

## Provare senza aspettare

Nell'SQL Editor:

```sql
select public.sveglia_invio_email();
```

Restituisce quanti avvisi ha trovato da spedire. Se dà `0`, non c'è niente in
coda: assegna un task a un collega e riprova.

Per vedere cosa ha risposto l'app:

```sql
select status_code, content
from net._http_response
order by created desc
limit 3;
```

| Cosa leggi | Cosa significa |
|---|---|
| `200` con `"spedite": 1` | è partita |
| `200` con `"spedite": 0` | nessuno da spedire, o tutti hanno spento l'interruttore |
| `503` | manca una variabile su Vercel, o non hai ridistribuito |
| `404` | il segreto non coincide fra Supabase e Vercel |
| `307` | la rotta è finita dietro il cancello: l'eccezione in `proxy.ts` non c'è più |

---

## Cosa NON manda una mail

Scelte deliberate, tutte verificate da `npm run verify:email`:

- **Un lavoro che ti crei da solo.** Lo sai già: è M14 che non scrive
  nemmeno l'avviso.
- **Un task che nasce già chiuso o archiviato.** È un travaso di storico,
  non lavoro che arriva.
- **Chi ha spento l'interruttore** in Impostazioni › Aspetto › Avvisi.
- **Chi è disattivato o non ha un indirizzo** in `profiles`.
- **L'arretrato.** Al primo giro si guardano solo le ultime 24 ore:
  senza quel filtro, accendere la funzione spedirebbe a tutti tutto lo
  storico dell'app in una volta.

E una che vale la pena sapere: gli avvisi si segnano spediti **solo dopo**
che Resend ha accettato. Se il fornitore rifiuta, il giro dopo riprova,
invece di perdere la mail in silenzio.

---

## Spegnere tutto

Per fermare gli invii senza toccare il codice:

```sql
select cron.unschedule('email-assegnazioni');
```

Per riaccenderli:

```sql
select cron.schedule('email-assegnazioni', '*/5 * * * *',
                     'select public.sveglia_invio_email();');
```

Oppure, più brutalmente, si toglie `RESEND_API_KEY` da Vercel: la rotta
risponde `503` e non manda niente.
