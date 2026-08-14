# Changelog

Tutti gli update di Lacertosus Office OS, in ordine cronologico inverso.
Ogni novità arriva qui **nella stessa PR** che la introduce e, dopo il merge,
diventa una **Release «Update»** su GitHub (regole in
[`CONTRIBUTING.md`](CONTRIBUTING.md)). Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/), con date al posto delle
versioni (fase pre-1.0).

## Non rilasciato

### Corretto
- **Gli inviti non portavano da nessuna parte**: il link riportava alla radice
  del sito invece che alla pagina della password, e il token — che viaggia
  nel frammento dell'URL — si perdeva nel rimbalzo al login. Ora l'invito
  punta a `/auth/confirm`, dove il token viene consumato. (#20)

### Aggiunto
- **Password dimenticata** nella pagina di accesso. Serviva anche a chi e
  stato invitato e ha perso il link: un secondo invito verrebbe rifiutato
  perche l'account esiste gia, e senza recupero resterebbe fuori senza
  rimedio. (#20)

## Update 2026-08-14

### Aggiunto
- **Layout della dashboard e fasi compresse seguono la persona**: erano le
  ultime due preferenze rimaste chiuse in un browser. Ora stanno su
  `user_preferences`, come accento e densita. (#19)
- **Ruoli e disattivazione** dalla pagina Team: promozione e retrocessione
  fra Member e Admin, disattivazione di chi lascia. Le regole le impone il
  database — non si resta senza amministratori attivi e non si disattiva chi
  ha ancora task aperti — e il suo rifiuto viene mostrato cosi com'e. (#18)

### Corretto
- **Residui della fase placeholder**: il pulsante «Azzera dati demo»
  cancellava una chiave di `localStorage` che non esiste piu — non
  azzerava nulla, ricaricava soltanto. Il pannello «In arrivo con il
  collegamento a Supabase» prometteva funzioni gia fatte. La schermata Info
  dichiarava «Dati salvati in questo browser». Tutti corretti. (#19)
- **I promemoria automatici funzionano davvero**. Problemi fermi da oltre 48
  ore, richieste e ferie in attesa: erano generati dal browser di chi aveva
  per caso una scheda aperta, e per tre ragioni non arrivavano a destinazione
  — nessun avviso se nessuno teneva l'app aperta, il database li rifiutava
  perché attribuiti al richiedente invece che a chi scriveva, e due schede
  aperte producevano due avvisi per lo stesso fatto. Ora sono una funzione
  pianificata che gira ogni ora lato server. (#17)

### Cambiato
- **Gli avvisi possono non avere un mittente**: dove il promemoria è
  automatico compare «Sistema» invece del nome di una persona che non ha
  scritto nulla. (#17)
- La deduplicazione non usa più marcatori da tenere allineati: ogni avviso
  automatico porta una chiave e un indice unico impedisce i doppioni, quindi
  la funzione è idempotente. Gli avvisi scritti dalle persone restano
  ripetibili, perché un sollecito si manda anche due volte. (#17)

### Note per chi aggiorna
- Serve la migrazione **M5** e l'estensione `pg_cron` attiva. Verifica con
  `select jobname, schedule, active from cron.job;` — deve comparire
  `escalations-orarie`. (#17)

## Update 2026-08-13

### Aggiunto
- **Supabase collegato**: l'app esce dalla fase placeholder. Autenticazione
  reale con email e password, sessione rinnovata a ogni richiesta, protezione
  di tutte le rotte con ritorno alla pagina richiesta dopo l'accesso.
- **Primo accesso guidato**: nome, cognome, qualifica, foto e preferenze
  d'aspetto alla prima entrata. Senza, il nome resterebbe quello dedotto
  dall'email (`francesco.s`). Marcato da `profiles.onboarded_at`.
- **Foto profilo su Supabase Storage**: bucket dedicato, limite 2 MB, ognuno
  scrive solo nella propria cartella. Al posto delle immagini nel browser.
- **Chat interna** con canale «Generale» e un canale per progetto: messaggi
  dal vivo, presenza di chi è collegato, menzioni con `@` che generano avvisi,
  conteggio dei non letti per canale. Linguetta a semicerchio al centro del
  bordo inferiore.
- **Creazione progetti**: il pulsante «Nuovo progetto», disabilitato da
  luglio, ora crea davvero.
- **Inviti**: «Invita» crea l'utente e manda l'email per impostare la
  password. Solo per i responsabili, verificato lato server.
- **Preferenze portabili**: accento, densità e movimento seguono la persona
  fra computer diversi invece di restare in un browser.

### Cambiato
- **I dati vivono su Supabase**, non più in `localStorage`: task, progetti,
  fasi, commenti, cronologia, checklist, allegati, richieste, ferie,
  chiusure, avvisi, template, viste salvate, focus e posticipi. Ogni modifica
  è ottimistica e si annulla da sola se il database rifiuta.
- **Le fasi sono dati, non vincoli**: `tasks.status` è una chiave esterna
  verso la nuova tabella `task_statuses`. Le fasi personalizzate si
  aggiungono senza toccare lo schema, e i task di una fase eliminata tornano
  in «Da fare» da soli.
- **Il workspace parte vuoto**: eliminati `lib/mock-data.ts` e i dati demo.
- **`middleware.ts` è diventato `proxy.ts`**, come impone Next 16.
- Rimosso «Vedi come…» dalla sidebar: su sessioni vere sarebbe impersonare un
  collega, e la RLS non lo consentirebbe comunque.

### Corretto
- **Claudio P. e la chat non si sovrappongono più**: la chat è passata al
  centro del bordo inferiore, lasciando libero l'angolo del Cavaliere.
- **Caricamento della chat**: una richiesta invece di una per progetto.
- **Migrazione M4**: l'attivazione di Realtime è isolata in un blocco con
  gestione dell'eccezione. Senza, un permesso mancante sulla pubblicazione
  annullava l'intera migrazione — tabelle comprese — senza alcun segnale.

### Note per chi aggiorna
- Servono le migrazioni **M2, M3 e M4** e un `.env.local` compilato. (#16)
- Le notifiche di escalation (problemi fermi, richieste e ferie in attesa)
  restano vive solo nella sessione: sono generate dal browser e la policy non
  ne consente la scrittura a nome altrui. Vanno spostate su una funzione
  pianificata lato server. (#16)

## Update 2026-08-05

### Aggiunto
- **Ferie & Permessi**: richieste con conteggio dei giorni lavorativi,
  approvazione/rifiuto dei responsabili, calendario dell'ufficio con assenze
  approvate e chiusure aziendali; promemoria automatico sulle decisioni in
  attesa. Nuova voce di navigazione «Ferie». (#13)
- **Foto profilo** con upload e ritaglio quadrato lato client (`avatar_url`,
  pronta per Supabase Storage). (#13)

### Corretto
- **Notifiche duplicate**: le escalation automatiche (problemi fermi >48h,
  richieste e ferie in attesa) sono ora one-shot **per episodio**, con
  marcatori persistiti — ricaricare l'app non genera più copie identiche;
  bonifica automatica dei doppioni storici in campanella. (#12)

### Documentazione
- **README completo**: panoramica, funzionalità per modulo, architettura,
  numeri di performance misurati e 8 screenshot reali della build di
  produzione. (#14)

## Update 2026-08-04

### Prestazioni
- **Architettura performance** (#11): React Compiler nativo Rust attivo,
  tutte le route statiche e prefetchate, navigazione «shallow» dello stato di
  vista (`lib/shallow-nav.ts` + `SearchLink`: ~1 ms, zero round-trip),
  mutazioni istantanee senza latenza artificiale, store memoizzato, drag
  della board senza re-render, overlay e viste secondarie in chunk lazy,
  aure senza `filter: blur`, persistenza nei momenti di quiete. Misurato:
  submit 13–22 ms, apertura pannello 31–84 ms.

### Aggiunto
- **Dashboard su misura**: blocchi riordinabili col drag, ridimensionabili,
  mostrabili/nascondibili, con ripristino. (#11)
- **Richieste di task**: chiunque propone, i responsabili approvano
  scegliendo assegnatario/scadenza/progetto o rifiutano con motivo (#5);
  upgrade con «serve entro», urgenza, ritiro, promemoria anti-attesa e
  provenienza visibile nel task. (#6)
- **Impostazioni → Aspetto**: 6 accenti colore, 3 densità, movimento
  ridotto; pagina Info e qualifica sul profilo. (#8)
- **Dashboard**: standup in topbar e KPI tile con fascia trend. (#7)
- **Board**: fasi comprimibili in strip verticali, persistite per utente. (#3)
- **Tooltip automatico** sui testi troncati in tutta l'app. (#4)

### Modificato
- Aggiornamento a **Next.js 16.3**. (#9)

### Corretto
- Overflow e clipping su tutte le pagine (mobile, tablet, desktop). (#2)

### Processo
- Flusso a branch personali + PR (`CONTRIBUTING.md`) (#1) e comando
  `scripts/worktree.mjs` per le sessioni parallele in copie isolate. (#10)

## Fondazione — luglio 2026

Costruzione del prodotto, prima del flusso a PR:

- Design system (token, tipografia, componenti base, styleguide) e restyle
  «SaaS premium» su mockup, poi revisione «Vetro» con aure ambientali.
- App completa: shell, dashboard, board Kanban con drag artigianale,
  pannello task, progetti, team, impostazioni, login.
- Sei upgrade: calendario mensile, command palette ⌘K, allegati-link,
  ricorrenza «furba», timeline di progetto, Focus di oggi + standup.
- Fasi custom + fase «Problema», board a corsie, pagina Progetti operativa,
  polso del team, tour introduttivo.
- Pacchetto collaborazione: template, viste salvate, snooze, bacheca di
  progetto con decisioni, reazioni, @Team, flusso problemi con escalation.
- Pianificazione mensile: attività ricorrenti configurabili e pianificatore
  «Ricorrenti»; pacchetto «deep»: checklist, undo, template multi-task,
  registro eventi, vista Carico, campanella con tab, auto-archivio,
  board da tastiera, report a intervallo con CSV/stampa, backup config.
- Schema Supabase M1 (migrazione iniziale, RLS completa, seed e test pgTAP).
- Easter egg «Il Capo» — Claudio P., il Cavaliere di Parma.
