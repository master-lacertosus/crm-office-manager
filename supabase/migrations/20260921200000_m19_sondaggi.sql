-- =============================================================================
-- Lacertosus Office OS -- migrazione M19: i sondaggi al team
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- COSA SERVE. Una domanda al gruppo -- "che giorno facciamo la riunione?",
-- "quale delle due grafiche?" -- e le risposte di tutti, in fretta. Oggi si fa
-- in chat, e la risposta la da' chi scrive per primo mentre gli altri leggono
-- e lasciano perdere.
--
-- QUATTRO TABELLE, E LA RAGIONE PER CUI SONO QUATTRO.
--
-- Il voto e' ANONIMO: si vede CHI ha votato -- serve, con sei persone, per
-- sapere chi manca -- ma non COSA ha votato. La RLS di PostgreSQL e' ROW
-- level: non sa nascondere una colonna. Quindi l'urna e il registro sono due
-- tabelle diverse, ed e' l'unico modo onesto di ottenerlo:
--
--   sondaggio_schede  = l'urna. Chi + cosa. Ognuno vede SOLO la propria riga.
--   sondaggio_firme   = il registro. Chi, e basta. Lo vedono tutti.
--   sondaggio_opzioni = le opzioni, con il CONTEGGIO gia' sommato dentro.
--
-- I conteggi stanno sull'opzione e non si ricavano leggendo l'urna, perche'
-- l'urna nessuno la puo' leggere: li tiene aggiornati un trigger, che e'
-- l'unico a scriverli. E' anche cio' che fa funzionare Realtime -- un voto
-- cambia la riga dell'opzione, e il numero si muove sugli schermi di tutti.
--
-- UN SOLO SONDAGGIO ATTIVO PER VOLTA. E' stato chiesto, e ha senso: con sei
-- persone un popup vale qualcosa solo se e' LA domanda. Una fila di popup e'
-- peggio di una fila di sondaggi.
--
-- Ma un blocco senza uscita e' una trappola: un sondaggio che nessuno chiude
-- bloccherebbe la funzione per sempre. Quindi ogni sondaggio nasce con una
-- scadenza, si chiude DA SOLO quando l'ultima persona ha votato, lo puo'
-- chiudere chi l'ha lanciato, e uno scaduto lo puo' chiudere chiunque.
--
-- E il blocco NON e' affidato al solo indice unico. Un indice unico da' in
-- faccia "duplicate key value violates unique constraint" -- lo ha gia' fatto
-- con le timbrature (vedi M18) -- e soprattutto lib/riprova.ts tratta il
-- codice 23505 come "gia' fatto" e lo INGHIOTTE in silenzio: il blocco
-- sarebbe invisibile. Percio' si lancia da una funzione che controlla prima e
-- alza una frase in italiano con il nome di chi ha il sondaggio aperto.
-- L'indice resta sotto, come rete, perche' due richieste nello stesso
-- millisecondo non passino tutte e due.
--
-- Regola del repo: additiva. M1-M18 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. La domanda
-- -----------------------------------------------------------------------------

create table if not exists public.sondaggi (
  id uuid primary key default gen_random_uuid(),
  autore_id uuid not null references public.profiles (id) on delete cascade,

  domanda text not null
    constraint sondaggi_domanda_sensata
    check (char_length(btrim(domanda)) between 3 and 200),

  aperto_at timestamptz not null default now(),
  scade_at timestamptz not null,

  -- NULL = attivo. E' lo stato, non un dato mancante: stessa forma di
  -- `timbrature.uscita` (M16).
  chiuso_at timestamptz,
  chiuso_da uuid references public.profiles (id) on delete set null,

  -- Quante persone attive c'erano al lancio. Serve per sapere quando hanno
  -- votato tutti, e va congelato: se qualcuno entra o esce dall'ufficio a
  -- meta' sondaggio, il traguardo non deve spostarsi sotto i piedi.
  aventi_diritto integer not null
    constraint sondaggi_aventi_diritto_sensato check (aventi_diritto > 0),

  -- Quante firme ci sono nel registro. E' una copia contata, non una verita'
  -- indipendente: la scrive lo stesso trigger che firma.
  voti_totali integer not null default 0,

  created_at timestamptz not null default now(),

  constraint sondaggi_scadenza_dopo_apertura check (scade_at > aperto_at),
  constraint sondaggi_chiusura_dopo_apertura
    check (chiuso_at is null or chiuso_at >= aperto_at)
);

comment on table public.sondaggi is
  'M19: una domanda al team. Il voto e'' anonimo: chi ha votato sta in sondaggio_firme, cosa ha votato in sondaggio_schede, e le due non si incrociano. Uno solo aperto per volta.';

comment on column public.sondaggi.chiuso_at is
  'NULL = sondaggio attivo. E'' lo stato, non un dato mancante.';

comment on column public.sondaggi.aventi_diritto is
  'M19: quante persone attive c''erano al lancio, congelate. Se cambiassero in corsa, il traguardo del "hanno votato tutti" si sposterebbe sotto i piedi.';

-- LA RETE DEL BLOCCO. Un indice unico su una costante con predicato parziale
-- vuol dire: al massimo una riga con chiuso_at nullo, in tutta la tabella.
-- Non e' questo a dare il messaggio -- lo da' lancia_sondaggio() -- ma e'
-- questo a impedire che due clic simultanei aprano due sondaggi.
create unique index if not exists sondaggi_uno_attivo_idx
  on public.sondaggi ((1))
  where chiuso_at is null;

-- Le domande che si fanno davvero: "ce n'e' uno aperto?" e "lo storico".
create index if not exists sondaggi_recenti_idx
  on public.sondaggi (aperto_at desc);

-- -----------------------------------------------------------------------------
-- 2. Le opzioni, col conteggio dentro
-- -----------------------------------------------------------------------------

create table if not exists public.sondaggio_opzioni (
  id uuid primary key default gen_random_uuid(),
  sondaggio_id uuid not null
    references public.sondaggi (id) on delete cascade,

  testo text not null
    constraint sondaggio_opzioni_testo_sensato
    check (char_length(btrim(testo)) between 1 and 80),

  posizione integer not null,

  -- Il conteggio vive qui e non si ricava sommando l'urna, perche' l'urna
  -- nessuno la puo' leggere. Lo tiene aggiornato sondaggio_schede_conta(), che
  -- e' l'unico a scriverlo.
  voti integer not null default 0
    constraint sondaggio_opzioni_voti_non_negativi check (voti >= 0),

  constraint sondaggio_opzioni_posizione_unica unique (sondaggio_id, posizione)
);

comment on table public.sondaggio_opzioni is
  'M19: le risposte possibili. La colonna `voti` e'' un totale mantenuto da trigger: e'' l''unico modo di mostrare i risultati senza aprire l''urna.';

create index if not exists sondaggio_opzioni_del_sondaggio_idx
  on public.sondaggio_opzioni (sondaggio_id, posizione);

-- -----------------------------------------------------------------------------
-- 3. L'urna: chi ha votato che cosa. Segreta.
-- -----------------------------------------------------------------------------

create table if not exists public.sondaggio_schede (
  sondaggio_id uuid not null
    references public.sondaggi (id) on delete cascade,
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  opzione_id uuid not null
    references public.sondaggio_opzioni (id) on delete cascade,
  votato_at timestamptz not null default now(),

  -- Una scheda a testa. E' cio' che rende la riga "il mio voto" invece di
  -- "uno dei miei voti".
  primary key (sondaggio_id, profile_id)
);

comment on table public.sondaggio_schede is
  'M19: l''urna. Ognuno vede SOLO la propria riga -- nemmeno un admin vede le altre. La RLS e'' row level e non sa nascondere una colonna: per questo "chi ha votato" sta in un''altra tabella.';

-- -----------------------------------------------------------------------------
-- 4. Il registro: chi ha votato. Pubblico.
-- -----------------------------------------------------------------------------

create table if not exists public.sondaggio_firme (
  sondaggio_id uuid not null
    references public.sondaggi (id) on delete cascade,
  profile_id uuid not null
    references public.profiles (id) on delete cascade,
  votato_at timestamptz not null default now(),

  primary key (sondaggio_id, profile_id)
);

comment on table public.sondaggio_firme is
  'M19: il registro. Dice CHE una persona ha votato, mai che cosa. Serve a sapere chi manca, che con sei persone e'' la domanda vera.';

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
--
-- Regola del repo (docs/SECURITY_MODEL.md): ogni tabella nuova nasce con la
-- RLS accesa e le policy esplicite NELLA STESSA migrazione.
--
-- Qui l'assenza di una policy e' una scelta, non una dimenticanza: su
-- `sondaggi`, `sondaggio_opzioni` e `sondaggio_firme` NON esiste alcuna policy
-- di scrittura. Si scrivono soltanto dalle funzioni security definer piu'
-- sotto, che sono il posto in cui vivono le regole (il blocco, la scadenza,
-- il conteggio). E' lo stesso meccanismo di public.impostazioni_invio in M15.
-- -----------------------------------------------------------------------------

alter table public.sondaggi enable row level security;
alter table public.sondaggio_opzioni enable row level security;
alter table public.sondaggio_schede enable row level security;
alter table public.sondaggio_firme enable row level security;

drop policy if exists sondaggi_select_membri on public.sondaggi;
drop policy if exists sondaggio_opzioni_select_membri on public.sondaggio_opzioni;
drop policy if exists sondaggio_firme_select_membri on public.sondaggio_firme;
drop policy if exists sondaggio_schede_select_propria on public.sondaggio_schede;
drop policy if exists sondaggio_schede_insert_propria on public.sondaggio_schede;
drop policy if exists sondaggio_schede_update_propria on public.sondaggio_schede;

-- Un sondaggio lo vede tutto l'ufficio: e' una domanda fatta all'ufficio.
create policy sondaggi_select_membri
  on public.sondaggi
  for select
  to authenticated
  using ((select public.is_active_member()));

create policy sondaggio_opzioni_select_membri
  on public.sondaggio_opzioni
  for select
  to authenticated
  using ((select public.is_active_member()));

-- Il registro e' pubblico per costruzione: non contiene le scelte.
create policy sondaggio_firme_select_membri
  on public.sondaggio_firme
  for select
  to authenticated
  using ((select public.is_active_member()));

-- L'urna: la propria scheda e basta. Nessuna eccezione per gli admin -- se
-- il titolare puo' vedere come hai votato, non hai votato, hai risposto.
create policy sondaggio_schede_select_propria
  on public.sondaggio_schede
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy sondaggio_schede_insert_propria
  on public.sondaggio_schede
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.is_active_member())
    and (select public.sondaggio_e_aperto(sondaggio_id))
  );

-- Si puo' cambiare idea finche' il sondaggio e' aperto. Un clic sbagliato in
-- un popup che si apre da solo e' troppo facile perche' il voto sia definitivo
-- al primo tocco.
create policy sondaggio_schede_update_propria
  on public.sondaggio_schede
  for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and (select public.sondaggio_e_aperto(sondaggio_id))
  );

-- -----------------------------------------------------------------------------
-- 6. "Questo sondaggio e' aperto?"
--
-- In una funzione e non scritta dentro la policy: una policy che interroga
-- un'altra tabella con la RLS accesa e' il modo in cui su questo repo e' gia'
-- nata una ricorsione (M11, 42P17, "infinite recursion detected in policy").
-- security definer + stable + search_path vuoto e' la forma che il controllo
-- automatico (scripts/rls-ricorsione-verify.mjs) pretende.
-- -----------------------------------------------------------------------------

create or replace function public.sondaggio_e_aperto(p_sondaggio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sondaggi s
    where s.id = p_sondaggio
      and s.chiuso_at is null
      and s.scade_at > now()
  );
$$;

comment on function public.sondaggio_e_aperto(uuid) is
  'M19: un sondaggio accetta voti? Vive in una funzione perche'' una policy che legge un''altra tabella con la RLS accesa e'' il modo in cui su questo repo e'' gia'' nata una ricorsione (M11).';

revoke execute on function public.sondaggio_e_aperto(uuid) from public, anon;
grant execute on function public.sondaggio_e_aperto(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Il conteggio, e la chiusura quando hanno votato tutti
--
-- security definer perche' la riga dell'opzione, la firma e il totale sul
-- sondaggio li scrive il database per conto di chi vota: da browser nessuno
-- ha il permesso di toccarli, ed e' giusto cosi'.
-- -----------------------------------------------------------------------------

create or replace function public.sondaggio_schede_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  firme integer;
  quanti integer;
begin
  if tg_op = 'INSERT' then
    update public.sondaggio_opzioni
       set voti = voti + 1
     where id = new.opzione_id;

    -- La firma, se non c'e' gia'. Una firma non si ripete quando si cambia
    -- idea: la persona aveva gia' votato.
    insert into public.sondaggio_firme (sondaggio_id, profile_id)
    values (new.sondaggio_id, new.profile_id)
    on conflict (sondaggio_id, profile_id) do nothing;

  elsif tg_op = 'UPDATE' then
    -- Cambio di idea: il totale delle persone non si muove, si spostano i
    -- voti da un'opzione all'altra.
    if new.opzione_id is distinct from old.opzione_id then
      update public.sondaggio_opzioni
         set voti = greatest(0, voti - 1)
       where id = old.opzione_id;
      update public.sondaggio_opzioni
         set voti = voti + 1
       where id = new.opzione_id;
    end if;
    return new;
  end if;

  select count(*) into firme
    from public.sondaggio_firme
   where sondaggio_id = new.sondaggio_id;

  select aventi_diritto into quanti
    from public.sondaggi
   where id = new.sondaggio_id;

  -- Il totale e' una copia contata, non una verita' indipendente: si riscrive
  -- da quello che c'e' nel registro invece di incrementarlo alla cieca.
  update public.sondaggi
     set voti_totali = firme,
         -- Hanno votato tutti: il sondaggio ha finito il suo lavoro, e
         -- tenerlo aperto bloccherebbe il prossimo per niente.
         chiuso_at = case
           when chiuso_at is null and firme >= quanti then now()
           else chiuso_at
         end
   where id = new.sondaggio_id;

  return new;
end;
$$;

comment on function public.sondaggio_schede_conta() is
  'M19: tiene i conteggi delle opzioni, firma il registro e chiude il sondaggio quando ha votato l''ultima persona. E'' l''unico scrittore di quelle tre cose.';

drop trigger if exists sondaggio_schede_conta on public.sondaggio_schede;

create trigger sondaggio_schede_conta
  after insert or update on public.sondaggio_schede
  for each row execute function public.sondaggio_schede_conta();

-- -----------------------------------------------------------------------------
-- 8. Chiudere
--
-- Chi l'ha lanciato, un admin, oppure chiunque se e' gia' scaduto -- questa
-- terza strada e' la valvola che impedisce al blocco di diventare una
-- trappola quando pg_cron non c'e'.
-- -----------------------------------------------------------------------------

create or replace function public.chiudi_sondaggio(p_sondaggio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sondaggi%rowtype;
begin
  select * into s from public.sondaggi where id = p_sondaggio;

  if not found then
    raise exception 'Questo sondaggio non esiste piu''.' using errcode = 'P0001';
  end if;

  if s.chiuso_at is not null then
    return;
  end if;

  if not (
    s.autore_id = (select auth.uid())
    or (select public.is_admin())
    or s.scade_at <= now()
  ) then
    raise exception 'Puo'' chiudere il sondaggio chi lo ha lanciato, o un amministratore.'
      using errcode = '42501';
  end if;

  update public.sondaggi
     set chiuso_at = now(),
         chiuso_da = (select auth.uid())
   where id = p_sondaggio;
end;
$$;

comment on function public.chiudi_sondaggio(uuid) is
  'M19: chiude un sondaggio. Lo puo'' fare chi lo ha lanciato, un admin, o chiunque se e'' gia'' scaduto -- l''ultima strada e'' la valvola che impedisce al blocco di diventare una trappola.';

revoke execute on function public.chiudi_sondaggio(uuid) from public, anon;
grant execute on function public.chiudi_sondaggio(uuid) to authenticated, service_role;

create or replace function public.chiudi_sondaggi_scaduti()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  quanti integer;
begin
  update public.sondaggi
     set chiuso_at = scade_at
   where chiuso_at is null
     and scade_at <= now();
  get diagnostics quanti = row_count;
  return quanti;
end;
$$;

comment on function public.chiudi_sondaggi_scaduti() is
  'M19: chiude i sondaggi scaduti. Pianificata con pg_cron ogni cinque minuti; chiuso_at prende la scadenza e non `now()`, cosi'' lo storico dice quando il sondaggio e'' finito davvero, non quando il lavoro se n''e'' accorto.';

revoke execute on function public.chiudi_sondaggi_scaduti() from public, anon;
grant execute on function public.chiudi_sondaggi_scaduti() to service_role;

-- -----------------------------------------------------------------------------
-- 9. Lanciare
--
-- Tutto in una funzione sola perche' sono quattro cose che devono riuscire o
-- fallire insieme: chiudere lo scaduto, verificare il blocco, scrivere la
-- domanda con le sue opzioni, avvisare l'ufficio.
--
-- E' anche l'unico posto in cui il blocco puo' produrre una frase leggibile:
-- l'indice unico direbbe "duplicate key value violates unique constraint", e
-- lib/riprova.ts tratta quel codice (23505) come "gia' fatto" e lo
-- inghiottirebbe in silenzio.
-- -----------------------------------------------------------------------------

create or replace function public.lancia_sondaggio(
  p_domanda text,
  p_opzioni text[],
  p_ore integer default 24
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuovo uuid;
  attivo public.sondaggi%rowtype;
  chi text;
  quanti integer;
  testo text;
  i integer := 0;
  destinatario uuid;
begin
  if not (select public.is_active_member()) then
    raise exception 'Solo chi fa parte dell''ufficio puo'' lanciare un sondaggio.'
      using errcode = '42501';
  end if;

  if p_ore < 1 or p_ore > 336 then
    raise exception 'La durata di un sondaggio va da un''ora a due settimane.'
      using errcode = 'P0001';
  end if;

  -- Prima di guardare se la strada e' libera, si toglie di mezzo cio' che e'
  -- gia' scaduto. Senza questo, un sondaggio dimenticato bloccherebbe tutti
  -- fino al passaggio successivo di pg_cron -- o per sempre, se pg_cron su
  -- questo progetto non fosse disponibile.
  perform public.chiudi_sondaggi_scaduti();

  select * into attivo
    from public.sondaggi
   where chiuso_at is null
   limit 1;

  if found then
    select p.full_name into chi
      from public.profiles p
     where p.id = attivo.autore_id;

    raise exception 'C''e'' gia'' un sondaggio aperto, lanciato da %: «%». Se ne fa uno per volta.',
      coalesce(chi, 'qualcuno'), attivo.domanda
      using errcode = 'P0001';
  end if;

  if array_length(p_opzioni, 1) is null or array_length(p_opzioni, 1) < 2 then
    raise exception 'Un sondaggio ha almeno due risposte fra cui scegliere.'
      using errcode = 'P0001';
  end if;

  if array_length(p_opzioni, 1) > 8 then
    raise exception 'Otto risposte sono il massimo: oltre, nessuno legge piu''.'
      using errcode = 'P0001';
  end if;

  select count(*) into quanti
    from public.profiles p
   where p.is_active;

  insert into public.sondaggi (autore_id, domanda, scade_at, aventi_diritto)
  values (
    (select auth.uid()),
    btrim(p_domanda),
    now() + make_interval(hours => p_ore),
    quanti
  )
  returning id into nuovo;

  foreach testo in array p_opzioni
  loop
    if char_length(btrim(testo)) > 0 then
      i := i + 1;
      insert into public.sondaggio_opzioni (sondaggio_id, testo, posizione)
      values (nuovo, btrim(testo), i);
    end if;
  end loop;

  if i < 2 then
    raise exception 'Un sondaggio ha almeno due risposte fra cui scegliere.'
      using errcode = 'P0001';
  end if;

  -- L'avviso lo scrive il database per conto di chi lancia: la policy di
  -- inserimento (M9) pretende `from_user_id = auth.uid()` una riga per volta,
  -- e qui le righe sono cinque. Stessa ragione di M14.
  for destinatario in
    select p.id from public.profiles p
     where p.is_active and p.id <> (select auth.uid())
  loop
    insert into public.notifications (to_user_id, from_user_id, message, kind, link)
    values (
      destinatario,
      (select auth.uid()),
      'Ha lanciato un sondaggio: «' || btrim(p_domanda) || '»',
      'sondaggio',
      '/sondaggi'
    );
  end loop;

  return nuovo;
end;
$$;

comment on function public.lancia_sondaggio(text, text[], integer) is
  'M19: lancia un sondaggio. Unico punto che puo'' aprirne uno: chiude lo scaduto, verifica che non ce ne sia gia'' uno aperto (con una frase leggibile, che l''indice unico non saprebbe dare), scrive domanda e opzioni, avvisa l''ufficio.';

revoke execute on function public.lancia_sondaggio(text, text[], integer) from public, anon;
grant execute on function public.lancia_sondaggio(text, text[], integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. La campanella impara una parola nuova
--
-- In PostgreSQL un CHECK non si allarga sul posto: si rifa'. E vanno
-- rielencati TUTTI i valori vecchi, perche' `add constraint` valida le righe
-- gia' presenti e fallirebbe su quelle che perderebbero il loro valore.
-- -----------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_kind_valid;

alter table public.notifications
  add constraint notifications_kind_valid
  check (kind in ('mention', 'sollecito', 'sistema', 'assegnazione', 'sondaggio'));

comment on column public.notifications.kind is
  'M19: natura dell''avviso -- mention, sollecito, sistema, assegnazione, sondaggio.';

commit;

-- =============================================================================
-- 11. Il lavoro che chiude gli scaduti
--
-- Fuori dalla transazione, come M5 e M15: se pg_cron non e' concesso a questo
-- ruolo, un errore qui dentro annullerebbe anche le tabelle create sopra.
-- Se manca, il warning dice come pianificarlo a mano -- e intanto la funzione
-- resta comunque utile, perche' lancia_sondaggio() la chiama da se'.
-- =============================================================================

do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('sondaggi-scaduti')
  where exists (select 1 from cron.job where jobname = 'sondaggi-scaduti');

  perform cron.schedule(
    'sondaggi-scaduti',
    '*/5 * * * *',
    'select public.chiudi_sondaggi_scaduti();'
  );
  raise notice 'Chiusura dei sondaggi scaduti pianificata ogni cinque minuti.';
exception
  when insufficient_privilege or undefined_file or feature_not_supported then
    raise warning
      'pg_cron non disponibile: chiudi_sondaggi_scaduti() e'' stata creata ma NON e'' pianificata. Attivala da Database > Extensions, poi esegui: select cron.schedule(''sondaggi-scaduti'', ''*/5 * * * *'', ''select public.chiudi_sondaggi_scaduti();''); Nel frattempo nessuno resta bloccato: chi lancia un sondaggio chiude gli scaduti per primo, e uno scaduto lo puo'' chiudere chiunque.';
end;
$$;

-- =============================================================================
-- 12. Realtime
--
-- Queste tre SI aggiungono alla publication, ed e' il punto della
-- funzionalita': un sondaggio lanciato deve comparire sugli schermi degli
-- altri senza che nessuno ricarichi la pagina, e i risultati devono muoversi
-- mentre la gente vota.
--
-- `sondaggio_schede` NO, e non e' una dimenticanza: e' l'urna. Non ha policy
-- di lettura per nessuno tranne il proprietario, quindi non porterebbe nulla
-- a nessun altro -- ma lasciarla fuori dice a chi legge questo file che non
-- deve entrarci mai.
-- =============================================================================

do $$
declare
  tabella text;
begin
  foreach tabella in array array[
    'sondaggi',
    'sondaggio_opzioni',
    'sondaggio_firme'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tabella
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tabella
      );
      raise notice 'Realtime attivo su public.%.', tabella;
    else
      raise notice 'Realtime era gia attivo su public.%.', tabella;
    end if;
  end loop;
exception
  when insufficient_privilege or wrong_object_type then
    raise notice
      'Publication non modificabile con questo ruolo: attivare Realtime a mano dal dashboard (Database > Publications).';
end;
$$;
