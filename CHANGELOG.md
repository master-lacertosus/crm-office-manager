# Changelog

Tutti gli update di Lacertosus Office OS, in ordine cronologico inverso.
Ogni novità arriva qui **nella stessa PR** che la introduce e, dopo il merge,
diventa una **Release «Update»** su GitHub (regole in
[`CONTRIBUTING.md`](CONTRIBUTING.md)). Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/), con date al posto delle
versioni (fase pre-1.0).

## Non rilasciato

### Aggiunto
- **Un file solo per aggiornare il database.** `supabase/AGGIORNA-DATABASE.sql`
  raccoglie M7, M8, M9 e M10 nell’ordine giusto: si apre il SQL Editor di
  Supabase, si incolla, si preme Run. Niente da scommentare, niente da
  modificare, e si può ridare due volte senza danno. (#37)
- **Collaboratori sui task**: un task puo coinvolgere piu persone senza
  perdere il responsabile unico. I collaboratori compaiono sulla scheda e
  ricevono gli avvisi, ma **non contano nel carico di lavoro** — quello resta
  su chi risponde del risultato, altrimenti lo stesso lavoro comparirebbe
  contato piu volte. Serve la migrazione **M6**. (#25)
- **Eliminazione di un task**, dal pannello di dettaglio. Mancava del tutto:
  un task creato per sbaglio non si poteva togliere in nessun modo. Con
  conferma esplicita e senza annulla, perche spariscono anche commenti,
  cronologia, checklist e allegati. Per togliere un task dalla board
  conservandone la storia resta l'archivio. (#24)

### Modificato
- **Il Capo esce di scena.** L'apparizione del Cavaliere è sospesa su
  richiesta: per ora non compare a nessuno, non risponde all'evocazione e
  non viene più annunciata dal tour. Non è cancellata — un interruttore in
  cima al componente la riporta in scena quando si vuole. (#32)

### Corretto
- **I file SQL da incollare ora sono in ASCII puro.** `audit-ruoli.sql` si
  fermava con un errore di sintassi: il file su disco è valido, ma stelle,
  virgolette basse e accenti sono la prima cosa che si rovina passando per
  gli appunti e un campo di testo dentro il browser. Tolti da `audit-ruoli.sql`,
  `allinea-ruoli.sql` e dai commenti di `AGGIORNA-DATABASE.sql`; le migrazioni
  sorgenti restano in italiano vero. `npm run verify:sql` ora lo pretende, e
  distingue: dentro una stringa un carattere rovinato fa un glifo storto,
  fuori ferma il database a metà lavoro. (#38)
- **Una migrazione non sarebbe partita.** Due funzioni di M9 avevano il
  delimitatore monco (`as $` invece di `as $$`): PostgreSQL si sarebbe
  fermato a metà applicazione, lasciando il database mezzo cambiato. Né la
  build né il typecheck guardano dentro i file .sql, quindi nessuno se ne
  era accorto. Ora ogni .sql passa dal parser vero di PostgreSQL
  (`npm run verify:sql`). (#37)
- **«Modifica non salvata» mentre il task veniva salvato.** Creando un task,
  la sua voce di cronologia partiva insieme al task invece che dopo: quando
  arrivava per prima, il database la respingeva perche punta a una riga che
  ancora non esisteva. Il task finiva salvato lo stesso — il pannello passava
  al dettaglio con checklist e allegati — ma intanto compariva un avviso che
  diceva il contrario. Ora le scritture escono in coda, nell ordine in cui
  nascono. (#36)
- **Gli errori dicono finalmente cosa e successo.** Il motivo del database
  veniva sostituito da un generico «salvataggio non riuscito» ogni volta che
  non arrivava nella forma attesa. Ora si legge la ragione vera, con il suo
  codice: «chiave esterna» e «policy che nega» sono problemi opposti e vanno
  distinti. (#36)
- **Creare un task non diceva se fosse andata bene.** Il task nasceva
  davvero, ma niente lo confermava: nessun messaggio, nessuna spunta, e il
  pannello restava identico a prima — cambiava solo l'etichetta del
  pulsante. Sembrava che il salvataggio fosse fallito. Ora compare il
  messaggio «*Titolo* creato» e il dettaglio nasce con la spunta «Creato»,
  mentre il pannello resta aperto sul task appena nato, dove si aggiungono
  checklist, allegati e commenti. (#27)
- **La scadenza scelta dal calendario non resta appesa all'URL.** Creando
  un task dal «+» di un giorno, il parametro `?due=` sopravviveva alla
  creazione e alla chiusura del pannello, e poteva ricomparire
  precompilato in un task creato dopo. (#27)
- **Gli inviti arrivavano già scaduti.** Chi veniva invitato apriva
  l'email e leggeva che il link era scaduto: per entrare doveva passare da
  «Password dimenticata». I link valgono una volta sola e i filtri antivirus
  delle caselle aziendali li aprono da soli per controllarli, consumandoli
  prima della persona. Ora il link porta a una pagina con un pulsante e il
  token si spende solo premendolo; se è comunque bruciato, si torna
  all'accesso con il recupero già aperto e il motivo spiegato — prima quel
  messaggio veniva costruito e poi buttato via, e si vedeva un login muto.
  La configurazione del dashboard sta in `docs/AUTH_SETUP.md`. (#30)
- **Template a più mani: fasi con responsabili diversi e avanzamento.** Un
  processo come «Creazione prodotto» sono testi, foto, caricamento,
  controllo: mani diverse, in ordine. Il template poteva già creare più task
  collegati, ma la cosa era sepolta sotto «pacchetto multi-task» e, una volta
  lanciata, il processo spariva. Ora l'editor parla di **fasi** numerate e
  riordinabili, ognuna col suo responsabile, e la scheda mostra il quadro
  d'insieme: tutte le fasi con stato e responsabile, la propria in evidenza,
  barra di avanzamento, blocchi segnalati e «adesso tocca a…». Ogni fase
  resta un task con un solo responsabile, così compare nella sua board e nel
  suo carico. Nessuna migrazione. (#31)
### Corretto
- **I task creati da un template non arrivavano mai al database.** Era
  l'unica creazione che non scriveva: le attività lanciate da un template —
  processi compresi — restavano in memoria, sparivano al ricaricamento e i
  colleghi non le vedevano. Con la checklist del template si perdevano anche
  le spunte. (#31)
- **Niente piu avvisi per decisioni mai avvenute.** Approvazioni, rifiuti e
  decisioni sulle ferie annunciavano l'esito prima di sapere se il database
  lo avesse accettato: quando lo rifiutava, la modifica tornava indietro ma
  gli avvisi erano gia partiti e restavano. I colleghi leggevano «X ha
  approvato» per approvazioni mai accadute. Ora si aspetta l'esito. (#23)
- **Le scritture rifiutate dal database ora si vedono.** Lo store annullava
  da solo le modifiche non salvate, ma in silenzio: si vedeva la propria
  modifica sparire senza sapere perche. Il difetto peggiore possibile, perche
  non sembrava nemmeno un errore. (#22)
- **Ferie: niente pulsanti che non possono funzionare.** Sulla propria
  richiesta non compaiono piu Approva e Rifiuta — la guardia del database
  vieta di decidere sulla propria assenza, e offrire l'azione portava solo a
  un rifiuto invisibile. (#22)
- **Gli inviti non portavano da nessuna parte**: il link riportava alla radice
  del sito invece che alla pagina della password, e il token — che viaggia
  nel frammento dell'URL — si perdeva nel rimbalzo al login. Ora l'invito
  punta a `/auth/confirm`, dove il token viene consumato. (#20)

### Aggiunto
- **Link password rimandabile da un responsabile**, dalla scheda della persona
  in Team: quando un collega non trova l'email dell'invito, si rimanda per
  lui invece di spiegargli dove cliccare. (#21)
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
