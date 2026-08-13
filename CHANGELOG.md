# Changelog

Tutti gli update di Lacertosus Office OS, in ordine cronologico inverso.
Ogni novità arriva qui **nella stessa PR** che la introduce e, dopo il merge,
diventa una **Release «Update»** su GitHub (regole in
[`CONTRIBUTING.md`](CONTRIBUTING.md)). Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/), con date al posto delle
versioni (fase pre-1.0).

## Non rilasciato

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
- Servono le migrazioni **M2, M3 e M4** e un `.env.local` compilato.
- Le notifiche di escalation (problemi fermi, richieste e ferie in attesa)
  restano vive solo nella sessione: sono generate dal browser e la policy non
  ne consente la scrittura a nome altrui. Vanno spostate su una funzione
  pianificata lato server.

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
