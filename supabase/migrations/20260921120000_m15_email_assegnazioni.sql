-- =============================================================================
-- Lacertosus Office OS -- migrazione M15: il lavoro assegnato arriva anche per email
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- DOPO averla eseguita serve UNA riga di configurazione, che NON sta qui
-- dentro perche' contiene un segreto e questo file finisce su GitHub.
-- Le istruzioni sono in fondo, sotto "ULTIMO PASSO".
--
-- -----------------------------------------------------------------------------
--
-- M14 ha fatto in modo che il lavoro assegnato si annunci dentro l'app: una
-- striscia in cima, un tab nella campanella, un pallino sulla voce Task. Resta
-- scoperto chi l'app non ce l'ha aperta -- il freelance che lavora a giornate
-- alterne, chi e' in giro, chi torna da due settimane di ferie. Per loro la
-- striscia c'e', ma la vedono quando ormai e' tardi.
--
-- Qui si aggiunge il secondo canale, e si riusa tutto quello che c'e' gia':
-- la riga in `notifications` che M14 scrive a ogni assegnazione e' anche
-- l'elenco di cosa spedire. Non serve una seconda coda da tenere allineata.
--
-- PERCHE' UNA FINESTRA E NON L'INVIO IMMEDIATO.
-- Un template a pacchetto, il pianificatore dei ricorrenti o un'azione
-- multipla creano molti task con un clic solo. A invio immediato sarebbero sei
-- mail in sei secondi, e sei mail in sei secondi insegnano a filtrarle tutte.
-- Il lavoro gira ogni cinque minuti e raggruppa per destinatario: un clic, una
-- mail. Con i volumi di oggi (circa un'assegnazione al giorno) si comporta
-- come l'invio immediato; il giorno che i volumi crescono, regge.
--
-- PERCHE' IL DATABASE CHIAMA L'APP, E NON SPEDISCE DA SE'.
-- Comporre una mail in SQL significa concatenare HTML dentro una funzione
-- plpgsql, e cambiarla significa una migrazione. Il testo di una mail si
-- ritocca dieci volte: sta meglio in TypeScript, dove si puo' anche provare.
-- Qui il database fa l'unica cosa che l'app non sa fare da sola -- svegliarsi
-- a orario -- e per il resto suona un campanello.
--
-- Regola del repo: additiva. M1-M14 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Quali avvisi sono gia' partiti
--
-- Senza un marcatore, ogni giro del lavoro rimanderebbe tutto da capo. La
-- colonna e' additiva e nullable: le righe di prima restano a NULL, e per non
-- spedire all'improvviso lo storico arretrato il lavoro guarda solo gli avvisi
-- recenti (vedi il filtro sull'eta' nella funzione qui sotto).
-- -----------------------------------------------------------------------------

alter table public.notifications
  add column if not exists email_inviata_at timestamptz;

comment on column public.notifications.email_inviata_at is
  'M15: quando l''avviso e'' stato spedito per email. NULL = mai spedito. Solo gli avvisi kind=''assegnazione'' vengono spediti.';

-- L'indice e' parziale sulle sole righe che il lavoro cerca davvero: e' una
-- manciata di righe su una tabella che cresce, e la ricerca deve restare
-- gratuita anche fra due anni.
create index if not exists notifications_da_spedire_idx
  on public.notifications (created_at)
  where kind = 'assegnazione' and email_inviata_at is null;

-- -----------------------------------------------------------------------------
-- 2. Dove vivono l'indirizzo dell'app e il segreto condiviso
--
-- NON in questo file: finisce su GitHub. Una tabella minuscola, con la RLS
-- accesa e NESSUNA policy: cosi' nessuno la legge dall'API, ne' un membro ne'
-- un anonimo, mentre la funzione `security definer` qui sotto -- che alla RLS
-- non passa -- la legge senza problemi. E' lo stesso meccanismo con cui M14
-- scrive gli avvisi.
-- -----------------------------------------------------------------------------

create table if not exists public.impostazioni_invio (
  id boolean primary key default true
    constraint impostazioni_invio_riga_unica check (id),
  -- L'indirizzo pubblico dell'app, senza barra finale. Es: https://lct-ufficio.vercel.app
  base_url text not null,
  -- Il segreto condiviso con la rotta dell'app: chi non lo presenta viene respinto.
  segreto text not null
    constraint impostazioni_invio_segreto_lungo
    check (char_length(segreto) >= 32),
  aggiornato_at timestamptz not null default now()
);

comment on table public.impostazioni_invio is
  'M15: indirizzo dell''app e segreto condiviso per la sveglia dell''invio email. Una riga sola. RLS accesa e nessuna policy: la legge solo la funzione security definer.';

alter table public.impostazioni_invio enable row level security;

-- -----------------------------------------------------------------------------
-- 3. pg_net: come il database bussa alla porta dell'app
--
-- Stessa prudenza che M5 ha usato per pg_cron: l'estensione potrebbe non
-- essere concessa al ruolo che applica la migrazione. In quel caso il resto
-- della migrazione va comunque a buon fine e si legge cosa fare a mano,
-- invece di trovarsi mezzo lavoro applicato senza saperlo.
-- -----------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_net;
  raise notice 'pg_net disponibile.';
exception
  when insufficient_privilege or undefined_file or feature_not_supported then
    raise warning
      'pg_net non disponibile: attivala da Database > Extensions e riesegui questo file. Senza, le email non partiranno (tutto il resto e'' stato applicato).';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. La sveglia
--
-- Non manda mail: dice all'app che e' ora di guardare. Tutta la decisione su
-- CHI riceve e COSA c'e' scritto sta dall'altra parte, in TypeScript.
--
-- Esce subito se non c'e' niente da spedire: un campanello suonato a vuoto
-- ogni cinque minuti per sempre sarebbe una richiesta HTTP inutile ogni cinque
-- minuti per sempre.
-- -----------------------------------------------------------------------------

create or replace function public.sveglia_invio_email()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  conf public.impostazioni_invio%rowtype;
  quanti integer;
begin
  select * into conf from public.impostazioni_invio where id limit 1;
  if not found then
    raise warning 'impostazioni_invio vuota: vedi ULTIMO PASSO in M15.';
    return 0;
  end if;

  -- Solo gli avvisi delle ultime 24 ore: la colonna nasce oggi, e senza
  -- questo filtro il primo giro spedirebbe tutto l'arretrato dell'app in
  -- faccia a tutti.
  select count(*) into quanti
  from public.notifications
  where kind = 'assegnazione'
    and email_inviata_at is null
    and created_at > now() - interval '24 hours';

  if quanti = 0 then
    return 0;
  end if;

  perform net.http_post(
    url := conf.base_url || '/api/avvisi-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-segreto-invio', conf.segreto
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );

  return quanti;
end;
$$;

comment on function public.sveglia_invio_email() is
  'M15: se ci sono avvisi di assegnazione non ancora spediti, bussa alla rotta /api/avvisi-email dell''app. Non compone e non manda nulla da se''.';

-- -----------------------------------------------------------------------------
-- 5. Ogni cinque minuti
--
-- Stesso schema di M5: se pg_cron non c'e', si dice come pianificarlo a mano
-- invece di far fallire tutto.
-- -----------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('email-assegnazioni')
  where exists (select 1 from cron.job where jobname = 'email-assegnazioni');

  perform cron.schedule(
    'email-assegnazioni',
    '*/5 * * * *',
    'select public.sveglia_invio_email();'
  );
  raise notice 'Invio email pianificato ogni cinque minuti.';
exception
  when insufficient_privilege or undefined_file or feature_not_supported then
    raise warning
      'pg_cron non disponibile: la funzione sveglia_invio_email() e'' stata creata ma NON e'' pianificata. Attivala da Database > Extensions, poi esegui: select cron.schedule(''email-assegnazioni'', ''*/5 * * * *'', ''select public.sveglia_invio_email();''); Tutto il resto della migrazione e'' andato a buon fine.';
end;
$$;

commit;

-- =============================================================================
-- ULTIMO PASSO -- da fare UNA VOLTA, e non da questo file
--
-- Esegui nell'SQL Editor, sostituendo i due valori:
--
--   insert into public.impostazioni_invio (id, base_url, segreto)
--   values (true, 'https://lct-ufficio.vercel.app', 'IL-SEGRETO-LUNGO')
--   on conflict (id) do update
--     set base_url = excluded.base_url,
--         segreto = excluded.segreto,
--         aggiornato_at = now();
--
-- Lo STESSO segreto va messo su Vercel come variabile SEGRETO_INVIO_EMAIL,
-- insieme a RESEND_API_KEY e MITTENTE_EMAIL. Finche' mancano, la rotta
-- risponde e non manda niente: nessun errore, nessuna mail.
--
-- Per provare subito senza aspettare i cinque minuti:
--   select public.sveglia_invio_email();
-- Restituisce quanti avvisi ha trovato da spedire.
-- =============================================================================
