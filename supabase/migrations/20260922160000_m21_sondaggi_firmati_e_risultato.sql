-- =============================================================================
-- Lacertosus Office OS -- migrazione M21: risposte firmate, e il risultato
-- che arriva a tutti
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- DUE COSE CHIESTE DALL'UFFICIO, e sono opposte solo in apparenza.
--
-- 1. "Vorrei vedere chi vota dei singoli sondaggi."
--
--    M19 aveva fatto una scelta secca: voto anonimo, punto. Era la scelta
--    giusta come PREDEFINITO e resta tale -- in un ufficio di sei persone,
--    dove il titolare vede i voti, la gente vota quello che si aspetta che il
--    titolare voglia sentire, e un sondaggio che raccoglie risposte di
--    cortesia non serve a niente.
--
--    Ma non tutte le domande sono quel tipo di domanda. "Pizza o sushi" e'
--    anonimo per delicatezza; "chi puo' coprire il turno di sabato" e' inutile
--    se non si sa CHI. Quindi lo decide chi lancia, domanda per domanda.
--
--    L'anonimato resta il valore di serie: chi non sceglie, ottiene il voto
--    segreto. Un'impostazione che protegge le persone non va messa dietro una
--    spunta da ricordarsi.
--
-- 2. "Mostrare il risultato a tutti quando completato."
--
--    Buco vero: l'unico avviso che il database mandava era al lancio. Un
--    sondaggio si chiudeva -- perche' avevano risposto tutti, perche' era
--    scaduto, perche' qualcuno l'aveva chiuso -- e non lo sapeva nessuno. La
--    risposta restava in una pagina che bisognava andarsi a cercare.
--
--    L'avviso nasce da un TRIGGER sulla chiusura e non dentro le funzioni che
--    chiudono, perche' le strade sono quattro: il trigger del conteggio quando
--    firma l'ultimo, chiudi_sondaggio(), chiudi_sondaggi_scaduti(), e il
--    lavoro pianificato di pg_cron. Quattro copie dello stesso avviso
--    divergono al primo ritocco -- su questo repo e' gia' successo con
--    l'ordinamento e con i filtri.
--
-- COME SI TIENE INSIEME L'URNA. La scheda resta una riga sola, e a decidere
-- se si puo' leggere e' il SONDAGGIO, non la scheda: la policy chiede "questo
-- sondaggio e' palese?" a una funzione, esattamente come gia' chiede "e'
-- aperto?". Cosi' l'anonimato continua a stare nel database e non
-- nell'interfaccia -- il che e' l'unico posto in cui un anonimato sia vero.
--
-- Regola del repo: additiva. M1-M20 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. La colonna
-- -----------------------------------------------------------------------------

alter table public.sondaggi
  add column if not exists palese boolean not null default false;

comment on column public.sondaggi.palese is
  'M21: false = risposte anonime (si vede chi ha votato, non cosa). true = risposte firmate, l''urna e'' leggibile da tutti i membri. Il valore di serie e'' false: un''impostazione che protegge le persone non si mette dietro una spunta da ricordarsi.';

-- -----------------------------------------------------------------------------
-- 2. "Questo sondaggio e' a risposte firmate?"
--
-- Come `sondaggio_e_aperto` e per la stessa ragione: una policy che interroga
-- un'altra tabella con la RLS accesa e' il modo in cui su questo repo e' gia'
-- nata una ricorsione (M11). E, come quella, sta PRIMA della policy che la
-- chiama: PostgreSQL risolve il nome nel momento in cui crea la policy.
-- -----------------------------------------------------------------------------

create or replace function public.sondaggio_e_palese(p_sondaggio uuid)
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
      and s.palese
  );
$$;

comment on function public.sondaggio_e_palese(uuid) is
  'M21: le schede di questo sondaggio sono leggibili da tutti? A decidere e'' il sondaggio, non la scheda.';

revoke execute on function public.sondaggio_e_palese(uuid) from public, anon;
grant execute on function public.sondaggio_e_palese(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. L'urna si apre solo dove e' stato dichiarato
--
-- La propria scheda si vede sempre. Le altre solo se il sondaggio e' palese:
-- e' l'unica riga che cambia, ed e' il punto in cui questa migrazione vive o
-- muore. Se un giorno qualcuno la allarga "per comodita'", l'anonimato
-- dichiarato in interfaccia diventa una bugia -- e i test in
-- supabase/tests/rls.test.sql sono li' per accorgersene.
-- -----------------------------------------------------------------------------

drop policy if exists sondaggio_schede_select_propria on public.sondaggio_schede;

create policy sondaggio_schede_select_propria
  on public.sondaggio_schede
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      (select public.is_active_member())
      and (select public.sondaggio_e_palese(sondaggio_id))
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Lanciare, dichiarando se le risposte si firmano
--
-- Quattro parametri, e il quarto NON ha un valore di serie: e' cio' che
-- permette alla versione a tre di continuare a esistere senza ambiguita'.
-- Con un `default false` qui, una chiamata a tre argomenti combacerebbe con
-- tutte e due le funzioni e PostgreSQL direbbe "function is not unique".
-- -----------------------------------------------------------------------------

create or replace function public.lancia_sondaggio(
  p_domanda text,
  p_opzioni text[],
  p_scade_at timestamptz,
  p_palese boolean
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

  if p_scade_at is null or p_scade_at < now() + interval '15 minutes' then
    raise exception 'La scadenza deve essere almeno fra un quarto d''ora: prima, nessuno fa in tempo a rispondere.'
      using errcode = 'P0001';
  end if;

  if p_scade_at > now() + interval '14 days' then
    raise exception 'Due settimane sono il massimo: oltre, un sondaggio non se lo ricorda piu'' nessuno.'
      using errcode = 'P0001';
  end if;

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

  insert into public.sondaggi
    (autore_id, domanda, scade_at, aventi_diritto, palese)
  values
    ((select auth.uid()), btrim(p_domanda), p_scade_at, quanti,
     coalesce(p_palese, false))
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

  for destinatario in
    select p.id from public.profiles p
     where p.is_active and p.id <> (select auth.uid())
  loop
    insert into public.notifications (to_user_id, from_user_id, message, kind, link)
    values (
      destinatario,
      (select auth.uid()),
      case
        when coalesce(p_palese, false)
          then 'Ha lanciato un sondaggio a risposte firmate: «' || btrim(p_domanda) || '»'
        else 'Ha lanciato un sondaggio: «' || btrim(p_domanda) || '»'
      end,
      'sondaggio',
      '/sondaggi'
    );
  end loop;

  return nuovo;
end;
$$;

comment on function public.lancia_sondaggio(text, text[], timestamptz, boolean) is
  'M21: lancia un sondaggio dichiarando se le risposte si firmano. E'' la versione vera: quella a tre argomenti delega qui con false, e quella a ore delega a quella.';

revoke execute on function public.lancia_sondaggio(text, text[], timestamptz, boolean)
  from public, anon;
grant execute on function public.lancia_sondaggio(text, text[], timestamptz, boolean)
  to authenticated, service_role;

-- La versione a tre argomenti resta, e diventa "anonimo" scritto per esteso.
create or replace function public.lancia_sondaggio(
  p_domanda text,
  p_opzioni text[],
  p_scade_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.lancia_sondaggio(p_domanda, p_opzioni, p_scade_at, false);
end;
$$;

comment on function public.lancia_sondaggio(text, text[], timestamptz) is
  'M21: scorciatoia anonima, conservata per compatibilita''. Delega alla versione a quattro argomenti con palese = false.';

-- -----------------------------------------------------------------------------
-- 5. Il risultato arriva a tutti, comunque si sia chiuso
--
-- Un trigger sulla chiusura, non quattro avvisi dentro quattro funzioni. Le
-- strade per chiudere sono: firma l'ultima persona (trigger del conteggio),
-- lo chiude qualcuno a mano, scade e lo raccoglie chiudi_sondaggi_scaduti(),
-- oppure lo raccoglie il lavoro pianificato. Da qui passano tutte.
--
-- L'avviso lo riceve anche chi lo ha lanciato: e' il risultato, e serve
-- soprattutto a lui.
-- -----------------------------------------------------------------------------

create or replace function public.sondaggi_avvisa_risultato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  massimo integer;
  vincitrici text;
  quante integer;
  riepilogo text;
  destinatario uuid;
begin
  -- Solo il passaggio da aperto a chiuso. Un update qualunque su una riga
  -- gia' chiusa non deve riavvisare nessuno.
  if old.chiuso_at is not null or new.chiuso_at is null then
    return new;
  end if;

  select max(o.voti) into massimo
    from public.sondaggio_opzioni o
   where o.sondaggio_id = new.id;

  if coalesce(massimo, 0) = 0 then
    riepilogo := 'si e'' chiuso senza risposte';
  else
    -- Le opzioni a pari merito, tutte. Un pareggio e' un risultato, e
    -- incoronare la prima delle due sarebbe una bugia decisa dall'ordine di
    -- inserimento.
    select string_agg('«' || o.testo || '»', ' e ' order by o.posizione),
           count(*)
      into vincitrici, quante
      from public.sondaggio_opzioni o
     where o.sondaggio_id = new.id
       and o.voti = massimo;

    riepilogo := case
      when quante > 1
        then 'pari merito fra ' || vincitrici || ', ' || massimo ||
             ' voti a testa su ' || new.voti_totali
      else 'ha vinto ' || vincitrici || ', ' || massimo || ' su ' ||
           new.voti_totali
    end;
  end if;

  for destinatario in
    select p.id from public.profiles p where p.is_active
  loop
    insert into public.notifications (to_user_id, from_user_id, message, kind, link)
    values (
      destinatario,
      -- Senza mittente: non l'ha chiuso una persona in particolare, o l'ha
      -- chiuso il tempo. La campanella lo firma "Sistema", che e' la verita'.
      null,
      -- `left` perche' il messaggio ha un limite di mille caratteri (M2) e la
      -- domanda puo' arrivare a duecento: tagliare qui e' meglio che vedersi
      -- rifiutare l'avviso e perdere il risultato.
      left('Sondaggio chiuso: «' || new.domanda || '» — ' || riepilogo, 1000),
      'sondaggio',
      '/sondaggi'
    );
  end loop;

  return new;
end;
$$;

comment on function public.sondaggi_avvisa_risultato() is
  'M21: avvisa tutti del risultato quando un sondaggio si chiude, da qualunque delle quattro strade. Unica sorgente di quell''avviso.';

drop trigger if exists sondaggi_avvisa_risultato on public.sondaggi;

create trigger sondaggi_avvisa_risultato
  after update on public.sondaggi
  for each row execute function public.sondaggi_avvisa_risultato();

commit;

-- =============================================================================
-- Nota su Realtime: nessuna tabella nuova. `sondaggi` e `notifications` sono
-- gia' nella publication, quindi il risultato compare sugli schermi senza che
-- nessuno ricarichi -- sempre che la publication sia stata modificabile: in
-- caso contrario M19 ha scritto un avviso invece di fallire, e si rimedia da
-- Database > Publications.
-- =============================================================================
