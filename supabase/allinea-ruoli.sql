-- =============================================================================
-- ALLINEA I RUOLI -- promuove i responsabili e riporta gli altri a dipendenti.
--
-- Da eseguire quando supabase/audit-ruoli.sql mostra qualcuno di troppo (o
-- qualcuno che manca) fra i responsabili.
--
-- COME SI USA:
--   1. controlla le due email qui sotto, alla riga marcata QUI;
--   2. incolla tutto nel dashboard Supabase > SQL Editor ed esegui.
-- Non c'e' nient'altro da toccare: niente righe da scommentare.
--
-- Sicurezza: se una delle email non corrisponde a nessun profilo, il file si
-- ferma PRIMA di cambiare qualsiasi cosa e lo dice. Le invarianti del
-- database restano attive anche da qui: non si resta mai senza responsabili.
--
-- NOTA: questo file e' scritto in ASCII puro, senza accenti ne' simboli.
-- Non e' pigrizia: passa da un copia-e-incolla dentro un browser, e i
-- caratteri fuori dall'ASCII sono la prima cosa che si rovina per strada.
-- =============================================================================

do $$
declare
  -- QUI: le email dei responsabili. Si prendono dalla colonna "email" di
  --      audit-ruoli.sql, cosi' non si sbaglia a scriverle.
  responsabili text[] := array[
    'francesco@lacertosus.com',
    'sara@lacertosus.com'
  ];

  mancanti      text[];
  promossi      integer;
  declassati    integer;
begin
  -- 1. Le email esistono davvero? Un errore di battitura qui toglierebbe i
  --    permessi a tutti senza darli a nessuno.
  select array_agg(m) into mancanti
  from unnest(responsabili) m
  where not exists (
    select 1 from public.profiles where lower(email) = lower(m)
  );

  if mancanti is not null then
    raise exception
      'Queste email non corrispondono a nessun profilo: %. Controlla la scrittura in audit-ruoli.sql e riprova: non ho cambiato nulla.',
      array_to_string(mancanti, ', ');
  end if;

  -- 2. Prima si promuove: se si partisse dal declassamento, a meta' strada il
  --    workspace potrebbe restare senza responsabili e il database
  --    rifiuterebbe l'operazione.
  update public.profiles
  set role = 'admin', is_active = true
  where lower(email) in (select lower(x) from unnest(responsabili) as x)
    and (role <> 'admin' or not is_active);
  get diagnostics promossi = row_count;

  -- 3. Poi si riportano gli altri a dipendenti.
  update public.profiles
  set role = 'member'
  where role = 'admin'
    -- coalesce: un amministratore senza email non e' fra i due previsti,
    -- e senza questo il confronto darebbe NULL e lo lascerebbe amministratore.
    and coalesce(lower(email), '') not in (
      select lower(x) from unnest(responsabili) as x
    );
  get diagnostics declassati = row_count;

  raise notice
    'Fatto: % promossi, % riportati a dipendenti. Responsabili attivi ora: %.',
    promossi,
    declassati,
    (select count(*) from public.profiles where role = 'admin' and is_active);
end;
$$;

-- Controprova: deve mostrare solo i due responsabili previsti.
select full_name as persona, email, role as ruolo, is_active as attivo
from public.profiles
where role = 'admin'
order by full_name;
