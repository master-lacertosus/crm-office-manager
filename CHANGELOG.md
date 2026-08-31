# Changelog

Tutti gli update di Lacertosus Office OS, in ordine cronologico inverso.
Ogni novità arriva qui **nella stessa PR** che la introduce e, dopo il merge,
diventa una **Release «Update»** su GitHub (regole in
[`CONTRIBUTING.md`](CONTRIBUTING.md)). Formato ispirato a
[Keep a Changelog](https://keepachangelog.com/it/), con date al posto delle
versioni (fase pre-1.0).

## Non rilasciato

### Corretto
- **I pezzi scritti in creazione non si perdono più.** Il riquadro «Pezzi di
  questo lavoro» teneva una riga di bozza, e il pezzo entrava nell'elenco
  solo premendo Invio o il «+». Chi invece compilava quella riga e cliccava
  **«Crea task»** — cioè il gesto che conclude tutto il resto del modulo —
  se lo vedeva scartare senza un avviso, e doveva reinserirlo dopo. Quanto
  fosse comune lo dice il database: **in tutta la vita del prodotto nessun
  pezzo era mai nato insieme al suo lavoro**, mentre nove erano stati
  aggiunti a mano in un secondo momento. Ora salvando si prende anche
  quello che è rimasto in riga di scrittura, con chi era stato scelto nel
  menu — e se il menu non è stato toccato, con il responsabile predefinito
  invece che con nessuno. Riscrivere un pezzo già inserito non lo duplica.
  (#72)

### Aggiunto
- **Contrasto alto** (Impostazioni › Aspetto). La tavolozza normale rispetta
  le soglie WCAG, ma quelle soglie presuppongono uno schermo onesto: su un
  pannello che scalda i colori, con luce forte, o guardando di sbieco, il
  grigio tenue delle date sparisce lo stesso e non c'è token che tenga.
  Acceso, ogni livello di testo sale sopra **7:1** (soglia AAA) e i bordi si
  fanno vedere: si rinuncia alla gerarchia dei grigi in cambio di
  leggibilità. Vale su entrambi i temi, si applica prima del primo disegno e
  resta salvato sul profilo, quindi segue la persona da qualunque
  computer. (#71)

### Corretto
- **Il tema chiaro adesso è misurato, non dato per buono.** Il tema scuro lo
  controllavamo da tempo; il chiaro — quello che usano tutti tutto il
  giorno — non l'aveva mai misurato nessuno. Cinque contrasti erano sotto le
  soglie WCAG, e il peggiore era proprio quello delle **date e dei conteggi
  sulle schede: 2,44:1**, i primi a sparire su uno schermo caldo o poco
  contrastato. Ora sono tutti sopra soglia, con un margine: 3,55:1 le date,
  4,7:1 il rosso degli errori, le zone smorzate e lo stato «backlog». I
  colori sono stati scuriti del minimo necessario mantenendo la tinta, non
  scelti a occhio. (#70)
- **La pagina dichiara al browser che i colori se li sceglie da sé.** Il tema
  chiaro non dichiarava `color-scheme`, così i controlli nativi — tendine,
  campi data, barre di scorrimento — venivano disegnati con la combinazione
  del sistema: su un PC in modalità scura, widget neri in mezzo a una pagina
  chiara. È anche la dichiarazione che l'auto-dark del browser legge per
  decidere se lasciar stare una pagina che si gestisce da sola. (#70)

### Corretto
- **Un pezzo di lavoro dice sempre da dove viene.** Un lavoro grande si
  spezza in pezzi affidati a persone diverse, e i pezzi nascevano col solo
  titolo: chi apriva il proprio si trovava davanti «Check video prodotto
  disponibili» e nient'altro, senza traccia della richiesta che lo
  spiegava. Il brief c'era, salvo e intero sul lavoro principale, ma era
  irraggiungibile — e siccome il lavoro principale è spesso di un collega,
  da quando ognuno apre il CRM sui propri lavori non compariva nemmeno in
  board. Ora aprendo un pezzo si vede il lavoro da cui nasce, cliccabile,
  con la sua richiesta per intero sopra ogni altro campo. Il testo non
  viene copiato: resta uno solo, e se il lavoro principale lo corregge lo
  leggono tutti aggiornato. (#69)

### Aggiunto
- **I pezzi si possono creare con dei dettagli.** Il riquadro «Pezzi del
  lavoro» accettava solo titolo, responsabile e data: ora c'è anche un
  campo facoltativo per le istruzioni che valgono solo per quel pezzo — un
  formato, un percorso, una persona da sentire — che nel brief generale non
  starebbero. (#69)

### Corretto
- **Chi salva senza campo non perde più il lavoro.** Completa la correzione
  precedente: se il dispositivo dichiara di non avere rete, i tre
  tentativi non si bruciano più in un secondo scarso mentre la
  connessione non c'è affatto. Si aspetta invece che il campo torni — fino
  a 15 secondi — e a quel punto il salvataggio riparte da solo. È il caso
  del telefono in ascensore o in galleria: prima il task spariva e cinque
  secondi dopo, col campo tornato, non c'era più niente da recuperare. Se
  la rete non torna entro il limite ci si arrende subito, senza tenere
  ferma la coda per altri due giri a vuoto. (#68)

### Corretto
- **Un singhiozzo di rete non fa più perdere il lavoro.** Salvando un task
  o una richiesta di ferie capitava, saltuariamente, di leggere «TypeError:
  load failed — l'app è tornata com'era prima»: non era il salvataggio a
  essere rifiutato, era la richiesta a non partire, e al primo tentativo
  andato storto buttavamo via quello che era stato scritto. Ora una
  richiesta che non parte viene **ritentata** (tre volte, con pause
  crescenti) prima di arrendersi; un rifiuto del database invece non si
  ritenta, perché un no resta un no. Il ritentativo avviene senza lasciare
  il posto in coda, così l'ordine che protegge le chiavi esterne non
  cambia. E se davvero la connessione manca, ora si legge «Connessione
  assente o instabile: la modifica non è partita» invece del messaggio
  grezzo del browser. (#67)

### Aggiunto
- **Barra comandi: si scrive o si detta, e nascono i lavori.** Da Ctrl+K,
  quando quello che si scrive sembra un ordine («Crea una task per il
  progetto BACK TO GYM…») compare «Crea da questo testo», e la barra
  diventa composizione senza perdere quello che si era già scritto.
  Riconosce il preambolo del comando, i sotto-task elencati nella frase
  («con dentro scrittura testi Klea e caricamento online Lorenzo») e le
  date scritte per esteso. **Dettatura vocale** col riconoscimento del
  browser: nessuna chiave, nessun costo, e il pulsante compare solo dove
  il browser sa ascoltare. (#66)
- **In Zen si scrivono i task a parole.** «Devo fare un video entro venerdì
  per Rimini Wellness e mi serve da Lorenzo una landing entro il 12»
  diventa due lavori, due responsabili, due scadenze e un progetto. Nomi e
  progetti vengono **riconosciuti** contro il workspace vero, non
  indovinati: un collega che non esiste non può comparire. Ogni deduzione
  dice da dove viene («venerdì» → scadenza), e niente nasce senza
  anteprima. Nessun modello linguistico, nessun costo. (#65)
- **Il calendario mostra anche l’attività svolta** (richiesta di Riccardo).
  Diceva cosa scade; ora, con un interruttore, dice anche cosa è stato
  fatto: quanti task chiusi e quanti movimenti di fase, giorno per giorno,
  con il dettaglio nel suggerimento. Si registra da solo — nessuno deve
  ricordarsi di segnare niente, ed è il motivo per cui un pulsante «segna
  nel calendario» sarebbe rimasto inutilizzato. Spento di partenza: chi
  apre il calendario di solito vuole sapere cosa lo aspetta. (#64)
- **Tema scuro** (Impostazioni › Aspetto): chiaro, scuro, o quello del
  computer. Non è un’inversione dei colori chiari — quella dà un grigio
  slavato in cui il testo secondario sparisce — ma una seconda tavolozza
  costruita sulla stessa famiglia fredda. Si applica **prima del primo
  disegno**, come densità e accento: un tema scuro che arriva dopo
  l’idratazione è un lampo bianco in faccia a chi lavora al buio. Le 27
  superfici che erano bianche per sempre ora passano dai token. Nuovo
  controllo `npm run verify:tema`, che misura 21 contrasti con la formula
  WCAG. (#61)
- **La ricerca (Ctrl+K) trova davvero tutto.** Prima guardava solo nei
  titoli di task aperti, progetti e persone. Ora cerca anche nelle
  descrizioni, e comprende task chiusi, richieste, ferie e commenti — è
  dentro le conversazioni che finisce il perché delle cose. I sotto-task
  dicono di quale lavoro sono un pezzo, e un tetto per categoria impedisce
  che cento commenti seppelliscano i due task che servivano. (#59)
- **Modalità Zen**, accanto alla chat: restano Task, Richieste e Progetti,
  spariscono le altre sette voci. Non nasconde dati, toglie di mezzo le
  destinazioni che adesso non servono. Resta accesa fra un ricaricamento e
  l’altro, e fra due schede aperte. (#59)
- **Azioni su più task insieme**, da board ed elenco. Una casella su ogni
  scheda, e una barra che compare in basso: sposta di fase, affida a
  qualcuno, cambia progetto. Un solo «Annulla» per tutto il gruppo.
  I permessi sono dichiarati **prima**: se fra i sette selezionati tre sono
  di un collega, la barra lo dice mentre si decide — non a cose fatte. Chi
  non può toccare niente trova i menu spenti, invece di scoprirlo dopo.
  Esc annulla la selezione, e cambiando sezione si svuota da sola. (#58)
- **I pezzi di un lavoro si scrivono già in creazione.** «Creazione
  prodotto» si pensa a pezzi fin dall’inizio: prima bisognava salvare il
  task, riaprirlo e solo allora spezzarlo. Ora titolo e incaricato si
  aggiungono nella prima schermata, e i pezzi nascono un istante dopo il
  padre — quando un id a cui appendersi finalmente esiste. Ereditano il suo
  progetto, come impone il database. (#57)
- **Una vista salvata può diventare il punto di partenza.** La stellina
  accanto al nome: da lì in poi i Task si aprono già filtrati come si
  vuole. Si applica solo se non è stato chiesto altro — un indirizzo con
  dei parametri viene da un link, dal tasto indietro o dalla memoria dei
  filtri, e sovrascriverlo sarebbe ignorare una richiesta esplicita per
  imporne una vecchia. Cancellando la vista di partenza la preferenza si
  libera, invece di restare a puntare nel vuoto. (#56)
- **Un progetto si crea mentre si scrive il task.** Prima, per un lavoro che
  non aveva ancora un progetto, bisognava abbandonare il task, andare in
  Progetti, crearlo e ricominciare: il primo task di ogni progetto nuovo
  costava quel giro, cioè proprio quando si ha più fretta. Ora c’è «+ Nuovo
  progetto…» nel menu, e se non ce n’è ancora nessuno un pulsante lo dice.
  Solo per i responsabili: la policy del database non consentirebbe agli
  altri di crearne, e offrire una porta che si apre con un no è peggio che
  non offrirla. (#55)
- **`npm run verify`**: tutti i controlli in un comando — tipi, regole, SQL,
  policy, permessi di visibilità, filtri, calendario dei freelance e build
  pulita. Con `-- --prod` interroga anche il sito vero: le pagine
  rispondono, sono le nostre e non una schermata di Vercel, e le correzioni
  recenti sono davvero quelle servite. Non si ferma al primo rosso: sapere
  che sono rotti tre controlli su otto è un’informazione diversa da «il
  primo è rotto». (#54)
- **Scorciatoie da tastiera**: `T` apre i Task, `P` i Progetti, `N` crea un
  task nuovo ovunque ci si trovi. Non scattano mentre si scrive, né con un
  pannello aperto, né in combinazione con Ctrl o Cmd — `Ctrl+P` resta la
  stampa. (#52)
- **«Solo le mie» accanto al profilo**: un interruttore per passare fra il
  proprio lavoro e quello del team. Vive nell’indirizzo, quindi il tasto
  indietro lo annulla e tornando nella sezione lo si ritrova. (#52)
- **Contatore dei task in corso** sulla voce Task: quanti se ne hanno
  aperti adesso, non il totale del workspace. (#52)
- **Si possono spegnere gli avvisi sul lavoro altrui** (Impostazioni ›
  Aspetto). La board continua ad aggiornarsi da sola: sparisce
  l’interruzione, non il dato. (#52)
- **Ruolo «freelance»: assenze anche di sabato e domenica.** Chi collabora a
  partita IVA non ha la settimana dell’ufficio, ma il calendario la dava per
  scontata: un sabato valeva zero giorni e il modulo rifiutava di mandare la
  richiesta, senza spiegare perché. Ora per un freelance ogni giorno conta,
  weekend compreso — e il numero è lo stesso per chi chiede e per chi
  approva. Sui permessi non cambia nulla: freelance e membro sono identici,
  responsabili restano solo gli admin. Le chiusure aziendali continuano a
  non consumare ferie per tutti. Serve la migrazione **M12**. (#49)
- **`scripts/imposta-password.mjs`**: imposta la password di un account da
  riga di comando, quando l’invio del link è bloccato e un collega deve
  entrare adesso. Non è un’azione dell’app ed è voluto: nel CRM un
  responsabile può rimandare il link, non entrare nell’account di un altro.
  La chiave di servizio resta sul computer di chi lo esegue. (#47)
- **`supabase/perche-non-salva.sql`**: diagnosi da incollare nel SQL Editor
  quando un salvataggio viene rifiutato. Controlla le colonne che l’app
  invia, chi può creare task, le regole e i trigger in vigore, e prova un
  inserimento vero cancellandolo subito. (#40)
- **Un file solo per aggiornare il database.** `supabase/AGGIORNA-DATABASE.sql`
  raccoglie M7, M8, M9 e M10 nell’ordine giusto: si apre il SQL Editor di
  Supabase, si incolla, si preme Run. Niente da scommentare, niente da
  modificare, e si può ridare due volte senza danno. (#37)
- **Ricorrenze: da tre cadenze a otto.** Si potevano ripetere i task solo
  ogni settimana, ogni 2 settimane o ogni mese: tutto ciò che in ufficio
  si ripete ogni giorno andava ricreato a mano ogni mattina. Ora ci sono
  anche **ogni giorno**, **ogni giorno feriale** (sabato e domenica
  saltati), **a giorni alterni**, **ogni 3 mesi** e **ogni anno**. In più,
  il giro successivo non nasce mai nel passato: completando in ritardo un
  ricorrente la nuova scadenza saltava già scaduta, e con le cadenze fitte
  l'arretrato si sarebbe accumulato a ogni giro. Serve la migrazione **M7**
  (allarga i vincoli su `tasks.repeat` e `workspace_templates.repeat`;
  nessun dato da convertire). (#28)
- **Sotto-task: un lavoro, più mani, un nome su ogni pezzo.** «Video
  prodotto X» non è un blocco solo: sono riprese, montaggio, testi,
  caricamento. Ora un task può contenere pezzi, e ogni pezzo è un task vero
  — con il suo responsabile, la sua scadenza, il suo stato — che compare
  nella board e nel carico di chi lo esegue. Il padre resta il quadro
  d'insieme, con un referente che risponde del risultato e una barra che
  dice a che punto è. I pezzi li affida chi guida il lavoro, oltre ai
  responsabili; sulla board portano l'etichetta del lavoro padre. Un lavoro
  diviso non si conta più insieme ai suoi pezzi: il carico di chi coordina
  sarebbe risultato doppio. Serve la migrazione **M10** (dopo M9). (#34)
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
- **La board si aggiorna da sola quando lavora qualcun altro.** I task
  inseriti o spostati dai colleghi comparivano solo ricaricando la pagina:
  chi non ricaricava guardava una fotografia vecchia senza saperlo, e
  finiva per assegnare due volte lo stesso lavoro. Ora un canale in tempo
  reale annuncia il cambiamento, i dati si rileggono da soli e un avviso
  dice perché la board si è mossa («Nuovo task da Marco»). Mai durante una
  scrittura in corso, mai a scheda nascosta; se il canale non si apre resta
  un controllo periodico. Serve la migrazione **M8** (attiva Realtime sulle
  tabelle del workspace). (#29)

### Modificato
- **Un task è una conversazione sola.** La descrizione apre il flusso come
  «La richiesta», e sotto seguono commenti e cronologia già intrecciati:
  prima si leggeva il «cosa» in cima e il «com’è andata» in fondo, senza
  che l’una tirasse l’altra. (#63)
- **Commentando si può spostare il task.** Chi scrive «fatto, mancano i
  testi» sta anche dicendo dove sta il lavoro: farglielo ripetere
  trascinando la scheda è chiedere due volte la stessa cosa. Il menu parte
  vuoto — la maggior parte dei commenti non sposta niente. (#63)
- **Un template a fasi ora crea un lavoro con i suoi pezzi.** Prima faceva
  N task fratelli legati da un `batch_id`: un secondo modo di dire «questo
  lavoro ha dei pezzi», accanto ai sotto-task. Due modi per la stessa idea
  significa scrivere ogni funzionalità futura due volte. Ora «Creazione
  prodotto» è un task con dentro «Scrittura testi» e «Caricamento
  online» — che è anche il modo in cui la si descrive a voce — e tutto
  quello che i sotto-task hanno già imparato vale da subito anche per i
  template. Migrazione **M13** (solo commenti, nessun dato toccato). (#62)
- **Le CTA reagiscono al passaggio del mouse**, come sul sito. Il colore si
  scuriva già, ma di scatto: mancava la transizione, e l’unico segno che il
  puntatore fosse sul bersaglio arrivava come un lampeggio. Ora sfondo e
  alone si muovono in 200ms — la stessa durata di `.btn-primary` di
  lacertosus.com, da cui è preso il comportamento. Premendo, l’alone
  rientra: il gesto ha una fine oltre che un inizio. Nessun movimento e
  nessun ingrandimento, come vuole il design system. (#60)
- **Chi non è responsabile ora apre il CRM sui propri task.** L’indirizzo
  senza filtri significava «tutti» per chiunque: un dipendente apriva la
  board e si trovava il lavoro di cinque colleghi da scremare a mano, ogni
  mattina. Il panorama completo serve a chi deve sorvegliarlo, quindi il
  predefinito segue il ruolo — responsabile: tutti; chiunque altro: i
  propri. Nessuno perde niente, «Tutto il team» resta a un clic. (#53)
- **`docs/AUTH_SETUP.md` ora dice il dominio vero**: `lct-ufficio.vercel.app`,
  verificato — risponde l’app, `/auth/conferma` è raggiungibile, nessuna
  Deployment Protection di mezzo. Con i due valori esatti da incollare in
  Supabase e il motivo per cui servono entrambi. (#46)
- **`docs/AUTH_SETUP.md`: via il dominio d’esempio.** Il documento usava
  `crm.lacertosus.com` come esempio di **Site URL**, ma quel dominio non
  esiste: copiato alla lettera manda ogni invito verso il vuoto, e a chi lo
  riceve sembra un link scaduto. Ora c’è un segnaposto che non si può
  scambiare per un valore, l’indicazione di copiare l’indirizzo da Vercel ›
  Domains, e una controprova per riconoscere la Deployment Protection, che
  blocca gli invitati con un login di Vercel. (#44)
- **Via i giudizi sul carico delle persone.** Nel «Polso del team» ogni
  collega portava un’etichetta — «Bilanciato», «Carico», «Sovraccarico» —
  decisa da soglie inventate: due task bilanciato, cinque sovraccarico. Un
  montaggio video da due giorni contava esattamente come una mail da
  mandare, e una supposizione prendeva l’aria di una misura. Restano i
  fatti: quanti task aperti, quanti in ritardo, e chi è in ferie o in
  permesso. (#42)
- **Il Capo esce di scena.** L'apparizione del Cavaliere è sospesa su
  richiesta: per ora non compare a nessuno, non risponde all'evocazione e
  non viene più annunciata dal tour. Non è cancellata — un interruttore in
  cima al componente la riporta in scena quando si vuole. (#32)

### Corretto
- **La build di /calendar si era rotta.** La memoria dei filtri usava
  `useSearchParams()` nella barra laterale, che sta nel layout e quindi
  dentro ogni pagina: quell’hook impedisce la generazione statica se non è
  avvolto in un `<Suspense>`. I filtri ora si annotano al clic leggendo
  `window.location`, senza rendere dinamico niente. Aggiunto
  `npm run verify:build`, che ricostruisce da zero come fa Vercel: la build
  normale riusa la cache e nascondeva l’errore. (#51)
- **Ctrl+K non sfocava lo sfondo.** Il velo era trasparente e basta: la
  sfocatura non c’era proprio, mentre il pannello dei task ce l’aveva. (#50)
- **L’accento arrivava solo a metà.** Scegliendo il verde restavano un alone
  arancione sotto le CTA, l’aura di sfondo arancione e la card-vetrina
  arancione: erano colori scritti a mano mentre lo sfondo seguiva l’accento.
  Ora derivano tutti dall’accento scelto. (#50)
- **Le richieste erano illeggibili.** Il testo c’era ed era completo, ma gli
  a-capo collassavano: un elenco puntato diventava un unico blocco
  corrente. Stessa correzione sulle note delle ferie. (#50)
- **La linguetta della chat si staccava dal bordo.** All’hover si sollevava
  di due pixel, lasciando vedere la pagina sotto una forma mezza tonda. Ora
  cresce verso l’alto restando incollata dov’è. (#50)
- **I filtri si perdevano cambiando pagina.** Filtrare i task, andare altrove
  e tornare riportava l’elenco completo. Ora ogni sezione ricorda i suoi
  filtri — non il pannello aperto, che riaprirsi da solo sarebbe una
  sorpresa. (#50)
- **Una vista salvata non si poteva togliere, solo eliminare.** Ora
  cliccarla di nuovo la disattiva, e la crocetta chiede conferma invece di
  cancellare al primo clic. (#50)
- **Lo standup era più stretto del resto del CRM** (1152px contro tutta la
  finestra). (#50)
- **Il task in pannello laterale era stretto**: 460px fissi anche su un
  monitor grande. Ora cresce con lo schermo. (#50)
- **«Link incompleto» su link perfettamente validi.** La pagina di conferma
  conosceva una sola delle tre forme che Supabase può mandare: `token_hash`
  nella query. Con i template predefiniti arriva invece un `code` (PKCE) o
  un frammento `#access_token`, che il server non vede nemmeno — e la
  pagina dava per rotto un link buono. Ora le riconosce tutte e tre: il
  `code` va alla rotta che lo scambia, il frammento viene portato alla
  pagina della password che sa già leggerlo. L’errore resta solo quando
  davvero non c’è niente. Nuovo controllo `npm run verify:link`. (#48)
- **«Salva modifiche» smetteva di rispondere.** Il pulsante è disabilitato
  mentre salva, e il gestore lo riabilitava alla fine — ma senza `finally`.
  Bastava un errore per non arrivarci mai: il pulsante restava spento per
  sempre e ogni clic successivo non faceva niente, nemmeno un messaggio.
  Sembrava che l’app ignorasse. Ora la riabilitazione avviene comunque, e
  il motivo compare a schermo. Stessa correzione sul profilo. (#45)
- **Gli errori nei componenti tornano leggibili.** Sette punti scartavano
  il motivo vero perché controllavano `instanceof Error`, e gli errori di
  Supabase non sono istanze di `Error`: finivano tutti nel ripiego. Erano
  già stati corretti nello store, non nei componenti. (#45)
- **Nessun task si poteva più creare: la policy si mordeva la coda.** Per
  permettere a un dipendente di appendere un pezzo a un lavoro di cui è
  referente, la policy di inserimento (M10) leggeva `tasks` con un `select`
  scritto in linea. Ma per leggere `tasks` PostgreSQL deve applicare le
  policy di `tasks` — quelle che sta già valutando: ricorsione infinita
  (`42P17`), e ogni creazione respinta, anche quelle senza padre. La
  migrazione **M11** sposta la domanda in una funzione `security definer`,
  che non ripassa dalle policy. Nuovo controllo `npm run verify:rls`. (#43)
- **Lo zoom-dezoom a ogni ricaricamento.** La densità scelta in Impostazioni
  rimappa `--spacing`, che in Tailwind è l’unità da cui discende ogni misura:
  cambiarla riscala l’interfaccia intera, del 9% fra «compatto» e «comodo».
  Veniva applicata da un effetto React, cioè dopo che il browser aveva già
  dipinto tutto alla misura predefinita. Ora un piccolo script nel `<head>`
  la applica prima del primo disegno: il primo fotogramma è già quello
  giusto, e non c’è più nessun salto da smorzare. Lo stesso vale per
  l’accento, che per un istante restava arancione. (#41)
- **L’errore sul salvataggio mostrava il sintomo, non la causa.** Quando il
  database rifiuta un task, la sua voce di cronologia partiva lo stesso e
  veniva respinta a sua volta perché puntava a una riga inesistente. Quel
  secondo errore arrivava dopo e copriva il primo: si leggeva «chiave
  esterna» senza sapere il motivo vero per cui il task non era nato. Ora le
  righe figlie di un task rifiutato non partono nemmeno, e a schermo resta
  il messaggio che spiega davvero cosa è successo. (#40)
- **Le fini riga ora le decide il repository.** Due file stavano in
  archivio con le righe terminate CRLF mentre il resto stava a LF: per git
  ogni riga risultava diversa da quella corrispondente sull’altro ramo, e
  invece di fondere produceva un file con dentro tutte e due le versioni —
  2944 righe al posto di 1474, con il pannello dei task disegnato due
  volte. Codice sintatticamente valido, quindi build, lint e typecheck non
  se ne accorgevano. Ora c’è un `.gitattributes` che impone LF. (#39)
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
- **Responsabili e dipendenti.** Il workspace aveva un modello di piena
  trasparenza: ogni membro attivo poteva modificare qualunque cosa. Ora i
  responsabili governano (approvano, assegnano, creano progetti, lanciano
  template) e i dipendenti lavorano ciò di cui rispondono: task propri,
  creati da loro o dove collaborano. Le pagine Team e Impostazioni ›
  Workspace non si aprono più digitando l'indirizzo. Il confine sta nel
  database (migrazione **M9**), non nei pulsanti nascosti. (#33)

### Corretto
- **Permessi: otto strade che non dovevano esistere.** Un dipendente poteva
  cancellare il task di chiunque in due mosse (riassegnarlo a sé, poi
  eliminarlo), modificare una propria ferie **già approvata** — date e firma
  di chi aveva approvato — e altrettanto su una richiesta approvata,
  zittire le escalation verso i responsabili indovinando la chiave di
  deduplicazione degli avvisi, inventare voci nel registro append-only con
  data a piacere, marcare come «decisione» i messaggi altrui e spostarli di
  progetto, togliere qualunque collaboratore da qualunque task, cambiare la
  propria email desincronizzandola dall'accesso. Un responsabile poteva
  approvare la propria richiesta di task (sulle ferie il divieto c'era
  già). Tutto chiuso in M9. (#33)
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
