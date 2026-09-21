-- =============================================================================
-- Lacertosus Office OS -- migrazione M16: le proprie ore
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- CHE COSA E', E SOPRATTUTTO CHE COSA NON E'.
--
-- E' un quaderno personale delle ore: si timbra entrando, si timbra uscendo,
-- e si vede quanto si e' fatto oggi, questa settimana, questo mese. Serve a
-- rispondere alla domanda che e' stata posta -- "com'e' andato il mese" -- e
-- si ferma li'.
--
-- NON e' un registro presenze e non alimenta nessuna busta paga. La
-- differenza non e' una sfumatura: un registro che finisce nella paga deve
-- conservare il valore precedente di ogni correzione, conoscere i festivi,
-- saper contare un permesso a ore, e farsi approvare gli straordinari da
-- qualcuno. Niente di tutto questo c'e' qui, e costruirlo a meta' sarebbe
-- peggio che non costruirlo: darebbe a un numero sbagliato l'aria di essere
-- ufficiale. docs/architecture.md:360 mette il time tracking fra le cose che
-- sono "un altro prodotto", e questa migrazione non contraddice quella riga:
-- la rispetta, fermandosi prima.
--
-- UNA RIGA PER GIORNATA, NON UNA PER TIMBRATURA.
-- La domanda vera e' "quante ore oggi", e una riga sola la risponde senza
-- aggregare. Chi esce e rientra non apre una riga nuova: corregge la sua.
-- Il costo di questa scelta e' che non si sa in quanti pezzi era divisa la
-- giornata -- informazione che, per la domanda posta, non serve a nessuno.
--
-- LA PAUSA SI SCALA, NON SI TIMBRA.
-- L'ufficio fa 8:30-17:30 con un'ora di pausa. Timbrare anche pranzo e
-- rientro darebbe il minuto esatto al prezzo di quattro gesti al giorno,
-- cioe' il modulo da compilare che docs/CLAUDE.md:8 rifiuta -- e chi
-- dimentica il rientro falsa la giornata piu' di quanto la falsi un'ora
-- fissa. Il patto e' dichiarato: due gesti, un'ora tolta, e chi salta il
-- pranzo lo sa.
--
-- CHI VEDE COSA: SOLO LE PROPRIE. Nemmeno un admin.
-- E' la policy degli avvisi (M2:788-790, "sono posta"), non quella delle
-- ferie. Le ferie sono un fatto organizzativo: se un collega e' via, il team
-- deve saperlo. L'ora in cui uno entra la mattina no. In un ufficio di sei
-- persone pubblicare la presenza quotidiana di ognuno davanti agli altri
-- crea una conversazione che nessuno ha chiesto, e toglierla dopo e' molto
-- piu' difficile che non metterla. Se un giorno servira' una vista per i
-- responsabili, si aggiunge una policy: additiva, e discussa allora.
--
-- Regola del repo: additiva. M1-M15 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Il quaderno
-- -----------------------------------------------------------------------------

create table if not exists public.timbrature (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- Il giorno LOCALE a cui la giornata appartiene, senza orario. Lo scrive il
  -- browser, che e' l'unico a sapere in che fuso si trova chi timbra: un
  -- `current_date` del database sposterebbe di un giorno chi timbra dopo
  -- mezzanotte. Stessa ragione per cui esiste `giornoLocale()` in lib/format.
  giorno date not null,

  entrata timestamptz not null,
  -- NULL = si sta ancora lavorando. E' lo stato, non un dato mancante.
  uscita timestamptz,

  -- Quanto si toglie per la pausa. Modificabile sulla singola giornata: il
  -- valore di serie e' un'ora, ma la giornata in cui non ci si e' fermati
  -- deve poterlo dire.
  pausa_minuti integer not null default 60
    constraint timbrature_pausa_sensata check (pausa_minuti between 0 and 480),

  -- Quando e' stata corretta a mano. Non conserva il valore precedente, e
  -- questo e' coerente con cio' che questa tabella e': un quaderno
  -- personale. Se un giorno servisse la paga, questa e' la prima riga da
  -- rifare, non un dettaglio da aggiungere in fondo.
  corretta_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Una giornata per persona per giorno: e' cio' che rende la riga "la mia
  -- giornata di oggi" invece di "una delle mie timbrature di oggi".
  constraint timbrature_una_per_giorno unique (profile_id, giorno),

  -- Si esce dopo essere entrati. Sembra ovvio, e un fuso sbagliato o un
  -- orario corretto a mano lo rendono possibilissimo.
  constraint timbrature_uscita_dopo_entrata
    check (uscita is null or uscita >= entrata)
);

comment on table public.timbrature is
  'M16: le ore di ciascuno, una riga per giornata. Quaderno personale, NON un registro presenze: non alimenta la paga, non conosce i festivi, non conta i permessi a ore. Visibile solo al proprietario, nemmeno agli admin.';

comment on column public.timbrature.giorno is
  'Giorno LOCALE della giornata lavorativa, scritto dal browser: il database non sa in che fuso si trova chi timbra.';

comment on column public.timbrature.uscita is
  'NULL = giornata ancora aperta. E'' lo stato, non un dato mancante.';

-- Le domande che si fanno davvero: "le mie giornate del mese" e "ho una
-- giornata aperta?". Due indici, nient'altro.
create index if not exists timbrature_mie_idx
  on public.timbrature (profile_id, giorno desc);

create unique index if not exists timbrature_una_aperta_idx
  on public.timbrature (profile_id)
  where uscita is null;

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
--
-- Regola del repo (docs/SECURITY_MODEL.md): ogni tabella nuova nasce con la
-- RLS accesa e le policy esplicite NELLA STESSA migrazione.
-- -----------------------------------------------------------------------------

alter table public.timbrature enable row level security;

drop policy if exists timbrature_select_proprie on public.timbrature;
drop policy if exists timbrature_insert_proprie on public.timbrature;
drop policy if exists timbrature_update_proprie on public.timbrature;
drop policy if exists timbrature_delete_proprie on public.timbrature;

-- Le proprie, e basta. Nessuna eccezione per gli admin: vedi il ragionamento
-- in testa al file.
create policy timbrature_select_proprie
  on public.timbrature for select to authenticated
  using (profile_id = (select auth.uid()));

-- Si timbra per se stessi. `is_active_member()` tiene fuori chi e' stato
-- disattivato ma ha ancora una sessione aperta.
create policy timbrature_insert_proprie
  on public.timbrature for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.is_active_member())
  );

-- Si corregge la propria giornata. Nessuna finestra temporale: una finestra
-- che si chiude a fine mese lascerebbe per sempre aperta una giornata
-- dimenticata il 31, e quell'unica riga aperta impedirebbe ogni timbratura
-- futura per via dell'indice unico.
create policy timbrature_update_proprie
  on public.timbrature for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy timbrature_delete_proprie
  on public.timbrature for delete to authenticated
  using (profile_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. La guardia
--
-- Le policy dicono CHI tocca cosa. La guardia dice cosa non ha senso, e vale
-- anche per chi arrivasse da fuori dell'app.
-- -----------------------------------------------------------------------------

create or replace function public.timbrature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nessuna giornata nel futuro: una timbratura di domani non e' una
  -- previsione, e' un errore di fuso o di dito.
  if new.giorno > (current_date + 1) then
    raise exception 'Non si timbra per un giorno futuro'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    -- La giornata non cambia proprietario e non cambia data: quella riga E'
    -- quella giornata di quella persona. Volerne un'altra significa crearne
    -- un'altra.
    if new.profile_id is distinct from old.profile_id
       or new.giorno is distinct from old.giorno then
      raise exception 'Di una giornata si correggono gli orari, non a chi e'' quando appartiene'
        using errcode = 'P0001';
    end if;

    -- Una correzione si vede. Non conserva il valore vecchio -- questo e' un
    -- quaderno, non un libro mastro -- ma almeno non finge di non essere mai
    -- avvenuta.
    if new.entrata is distinct from old.entrata
       or new.uscita is distinct from old.uscita
       or new.pausa_minuti is distinct from old.pausa_minuti then
      new.corretta_at := now();
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists timbrature_guard on public.timbrature;

create trigger timbrature_guard
  before insert or update on public.timbrature
  for each row execute function public.timbrature_guard();

commit;

-- =============================================================================
-- Nota su Realtime: `timbrature` NON viene aggiunta alla publication, di
-- proposito. Le proprie ore cambiano solo per mano propria, quindi non c'e'
-- niente da annunciare; e ogni annuncio farebbe rileggere allo store tutte e
-- diciotto le tabelle del workspace su ogni dispositivo, per una riga che
-- riguarda una persona sola.
-- =============================================================================
