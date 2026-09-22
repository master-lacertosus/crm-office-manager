-- =============================================================================
-- Lacertosus Office OS -- migrazione M20: la scadenza si sceglie, non si conta
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- IL PERCHE', detto dall'ufficio il giorno dopo aver acceso M19: "vorrei la
-- data di scadenza e non un intervallo di giorni".
--
-- Ha ragione, ed e' piu' di una preferenza. Un sondaggio si chiude quando
-- serve la risposta -- "prima della riunione di giovedi'", "entro stasera" --
-- non dopo un numero tondo di ore. Con le durate a scelta fissa, "entro
-- stasera" alle 15:23 non si poteva dire: si sceglieva "un giorno" e il
-- sondaggio scadeva domani alle 15:23, che non e' una scadenza, e' un caso.
--
-- COSA CAMBIA. `lancia_sondaggio` prende un momento invece di un numero di
-- ore. La versione a ore NON sparisce: resta, e delega alla nuova. E' la
-- regola additiva applicata a una funzione -- una firma che qualcuno potrebbe
-- avere in mano non si toglie da sotto i piedi, si fa diventare una scorciatoia.
--
-- PostgreSQL le tiene entrambe perche' hanno firme diverse, e PostgREST
-- sceglie in base ai NOMI dei parametri che arrivano: `p_ore` chiama una,
-- `p_scade_at` l'altra. Nessuna ambiguita'.
--
-- Regola del repo: additiva. M1-M19 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Lanciare, con un momento
--
-- Il corpo e' quello di M19 con una sola differenza: la scadenza arriva da
-- fuori invece di essere calcolata. I limiti restano, tradotti da "ore" a
-- "quando": non meno di un quarto d'ora (un sondaggio che scade prima che le
-- persone lo leggano non e' un sondaggio) e non piu' di due settimane.
-- -----------------------------------------------------------------------------

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

  -- Prima di guardare se la strada e' libera, si toglie di mezzo cio' che e'
  -- gia' scaduto.
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
  values ((select auth.uid()), btrim(p_domanda), p_scade_at, quanti)
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
      'Ha lanciato un sondaggio: «' || btrim(p_domanda) || '»',
      'sondaggio',
      '/sondaggi'
    );
  end loop;

  return nuovo;
end;
$$;

comment on function public.lancia_sondaggio(text, text[], timestamptz) is
  'M20: lancia un sondaggio con una scadenza scelta. E'' la versione vera: quella a ore delega qui.';

revoke execute on function public.lancia_sondaggio(text, text[], timestamptz) from public, anon;
grant execute on function public.lancia_sondaggio(text, text[], timestamptz) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. La versione a ore diventa una scorciatoia
--
-- Non si cancella: qualcuno potrebbe averla in mano, e una firma tolta da
-- sotto i piedi e' esattamente cio' che la regola additiva vieta. Adesso e'
-- una riga che converte e chiama l'altra, cosi' le regole vivono in un posto
-- solo e non possono divergere.
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
begin
  if p_ore < 1 or p_ore > 336 then
    raise exception 'La durata di un sondaggio va da un''ora a due settimane.'
      using errcode = 'P0001';
  end if;
  return public.lancia_sondaggio(
    p_domanda,
    p_opzioni,
    now() + make_interval(hours => p_ore)
  );
end;
$$;

comment on function public.lancia_sondaggio(text, text[], integer) is
  'M20: scorciatoia a ore, conservata per compatibilita''. Converte in un momento e delega alla versione con timestamptz, dove vivono le regole.';

commit;

-- =============================================================================
-- Nota su Realtime: nessuna tabella nuova, niente da aggiungere alla
-- publication. Se in M19 il blocco della publication avesse scritto
-- "Publication non modificabile con questo ruolo", si rimedia dal dashboard
-- (Database > Publications) aggiungendo `sondaggi`, `sondaggio_opzioni` e
-- `sondaggio_firme` -- ed e' il motivo per cui un sondaggio appena lanciato
-- poteva non comparire agli altri finche' non ricaricavano la pagina.
-- =============================================================================
