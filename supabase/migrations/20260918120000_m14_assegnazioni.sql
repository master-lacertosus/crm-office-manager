-- =============================================================================
-- Lacertosus Office OS -- migrazione M14: il lavoro assegnato si annuncia
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- Finora una task poteva comparire nella board di un collega senza che lui lo
-- sapesse. Chi assegnava lo dava per detto; chi riceveva se ne accorgeva solo
-- aprendo la pagina Task e notando una riga che prima non c'era. Il lavoro
-- arrivava in silenzio, e il silenzio si scambia facilmente per "non c'e'
-- niente da fare".
--
-- L'avviso non lo scrive il browser, di proposito. Le strade che assegnano
-- lavoro sono gia' cinque -- creazione, sotto-task, template a fasi, dettatura
-- Zen, approvazione di una richiesta -- e ognuna avrebbe dovuto ricordarsene,
-- compresa la sesta che scriveremo fra un mese. Qui la regola e' una sola, sta
-- dove i dati cambiano, e vale per ogni strada senza che nessuna la conosca.
-- E' la stessa lezione di M5: quello che deve succedere sempre non si affida
-- a chi ha l'app aperta.
--
-- Due momenti, non uno: una task che nasce con un responsabile diverso da chi
-- la crea, e una task che cambia responsabile. Il secondo e' lavoro che arriva
-- esattamente come il primo.
--
-- Nessuno si avvisa da solo: le task che ci si crea per se' non producono
-- niente, perche' saperle e' il motivo per cui le si e' scritte.
--
-- Regola del repo: additiva. M1-M13 non si toccano.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Una natura nuova per gli avvisi
--
-- "assegnazione" accanto a mention, sollecito e sistema. Serve una categoria
-- propria e non il riuso di "sistema" perche' la campanella la mostra in un
-- tab suo e il banner conta solo questi: mescolarla al resto vorrebbe dire
-- contare anche i promemoria degli snooze fra "le nuove task".
-- -----------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_kind_valid;

alter table public.notifications
  add constraint notifications_kind_valid
  check (kind in ('mention', 'sollecito', 'sistema', 'assegnazione'));

comment on column public.notifications.kind is
  'Natura dell''avviso: mention (ti hanno nominato), sollecito (ti stanno sollecitando), assegnazione (ti è arrivato un lavoro, M14), sistema (promemoria automatici).';

-- -----------------------------------------------------------------------------
-- 2. Chi consegna il lavoro lo dice
--
-- security definer perche' l'avviso lo scrive il database per conto di chi
-- assegna: la policy di inserimento (M9) pretende `from_user_id = auth.uid()`
-- e `dedupe_key is null`, vero all'inserimento da browser ma non quando a
-- riassegnare e' un lavoro pianificato senza sessione. Scrivendolo qui la
-- regola vale sempre, e resta l'unico punto che puo' creare un avviso di
-- assegnazione.
--
-- search_path vuoto: dentro una funzione security definer un search_path
-- ereditato e' il modo classico di farsi eseguire codice altrui. Tutto e'
-- qualificato per esteso.
-- -----------------------------------------------------------------------------

create or replace function public.tasks_avvisa_assegnazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mittente uuid;
begin
  -- Chi consegna: alla nascita e' chi ha creato la task, a una riassegnazione
  -- e' chi sta facendo la modifica adesso. `auth.uid()` e' NULL quando a
  -- scrivere e' un lavoro pianificato, e in quel caso l'avviso resta senza
  -- mittente -- la campanella lo firma "Sistema", che e' la verita'.
  if tg_op = 'INSERT' then
    mittente := new.created_by;
  else
    mittente := auth.uid();
  end if;

  -- Nessuno si avvisa da solo.
  if new.owner_id = coalesce(mittente, new.created_by) then
    return new;
  end if;

  -- Una task che nasce gia' chiusa o archiviata non e' lavoro che arriva: e'
  -- un travaso di storico (import, riorganizzazione, ricorrenza chiusa a
  -- posteriori). Avvisarne sarebbe rumore su cose che nessuno deve fare.
  if new.status = 'done' or new.archived_at is not null then
    return new;
  end if;

  insert into public.notifications (to_user_id, from_user_id, message, task_id, kind)
  values (
    new.owner_id,
    mittente,
    -- Il testo comincia con il verbo perche' la campanella stampa gia' il
    -- nome di chi scrive sulla riga sopra: "Marco Rossi / Ti ha assegnato".
    case
      when tg_op = 'INSERT' then 'Ti ha assegnato «' || new.title || '»'
      else 'Ti ha passato «' || new.title || '»'
    end,
    new.id,
    'assegnazione'
  );

  return new;
end;
$$;

comment on function public.tasks_avvisa_assegnazione() is
  'M14: avvisa il responsabile quando un lavoro gli arriva, alla nascita della task o al cambio di responsabile. Unica sorgente degli avvisi di tipo assegnazione.';

-- -----------------------------------------------------------------------------
-- 3. I due momenti
--
-- Due trigger e non uno con `after insert or update`: la clausola `when` che
-- confronta OLD e NEW non e' scrivibile su un trigger che copre anche
-- l'inserimento, e senza quel confronto ogni salvataggio che contiene
-- `owner_id` -- anche invariato -- manderebbe un avviso. Chi sposta una
-- scheda riceverebbe un "ti ha assegnato" per un lavoro che aveva gia'.
-- -----------------------------------------------------------------------------

drop trigger if exists tasks_avvisa_assegnazione_ins on public.tasks;
drop trigger if exists tasks_avvisa_assegnazione_upd on public.tasks;

create trigger tasks_avvisa_assegnazione_ins
  after insert on public.tasks
  for each row
  execute function public.tasks_avvisa_assegnazione();

create trigger tasks_avvisa_assegnazione_upd
  after update of owner_id on public.tasks
  for each row
  when (new.owner_id is distinct from old.owner_id)
  execute function public.tasks_avvisa_assegnazione();

commit;

-- =============================================================================
-- Nota su Realtime: `notifications` e' gia' nella publication da M8, quindi
-- l'avviso arriva al browser del destinatario senza ricaricare la pagina.
-- Niente da aggiungere qui.
-- =============================================================================
