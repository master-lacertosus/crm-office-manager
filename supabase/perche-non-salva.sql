-- =============================================================================
-- PERCHE' NON SALVA -- diagnosi, non riparazione.
--
-- Creando un task compare un errore sulla cronologia ("task_events ...
-- foreign key"). Quello e' l'eco: vuol dire che il TASK non e' stato
-- accettato, e la sua voce di cronologia e' rimasta a puntare al vuoto.
--
-- Questo file cerca il motivo vero, provando le stesse condizioni che il
-- database applica quando qualcuno crea un task.
--
-- COME SI USA: dashboard Supabase > SQL Editor, incollare tutto, premere
-- Run. Niente da modificare.
--
-- I punti da 1 a 4 leggono e basta. Il punto 5 crea un task di prova e lo
-- cancella nella riga successiva: e' l'unico modo di sapere con certezza
-- se il database accetta un inserimento, invece di dedurlo. Il tuo lavoro
-- non viene toccato.
--
-- Scritto in ASCII puro: passa da un copia-e-incolla dentro un browser.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le colonne che l'app invia esistono tutte?
--
-- L'app manda id, title, description, status, priority, owner_id, created_by,
-- project_id, due_date, position, repeat, template_id, batch_id, parent_id.
-- Se ne manca una, ogni inserimento fallisce e nessuna policy c'entra.
-- -----------------------------------------------------------------------------
with attese(nome) as (
  select unnest(array[
    'id','title','description','status','priority','owner_id','created_by',
    'project_id','due_date','position','repeat','template_id','batch_id',
    'parent_id'
  ])
)
select
  a.nome as colonna_attesa_da_app,
  case when c.column_name is null then 'MANCA NEL DATABASE' else 'presente' end as esito
from attese a
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'tasks'
 and c.column_name = a.nome
order by (c.column_name is null) desc, a.nome;

-- -----------------------------------------------------------------------------
-- 2. Chi puo' creare un task, e chi no
--
-- La policy pretende tre cose insieme:
--   a) essere un membro attivo
--   b) created_by uguale a chi sta scrivendo (l'app lo fa sempre)
--   c) essere responsabile, OPPURE assegnare il task a se stessi, OPPURE
--      appenderlo come pezzo a un lavoro di cui si e' referenti
--
-- Qui si guarda (a) e (c) per ogni persona: se una riga dice NO, quella
-- persona non riesce a creare task assegnati ad altri.
-- -----------------------------------------------------------------------------
select
  p.full_name as persona,
  p.email,
  p.role as ruolo,
  p.is_active as attivo,
  case
    when not p.is_active
      then 'NO -- profilo non attivo: non puo creare niente'
    when p.role = 'admin'
      then 'si -- responsabile: puo creare e assegnare a chiunque'
    else 'parziale -- puo creare solo task assegnati a se stesso'
  end as puo_creare_task
from public.profiles p
order by (not p.is_active) desc, p.role <> 'admin', p.full_name;

-- -----------------------------------------------------------------------------
-- 3. Le regole in vigore sulla tabella tasks
--
-- Se qui non compare nessuna policy di INSERT, nessuno puo' creare task.
-- Se ne compare piu' d'una, vale la piu' permissiva -- ma vale la pena
-- guardarle.
-- -----------------------------------------------------------------------------
select
  polname as regola,
  case polcmd
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'r' then 'SELECT'
    when 'd' then 'DELETE'
    else polcmd::text
  end as su_cosa
from pg_policy
where polrelid = 'public.tasks'::regclass
order by polcmd, polname;

-- -----------------------------------------------------------------------------
-- 4. I trigger che possono rifiutare un inserimento
--
-- Un trigger BEFORE INSERT puo' fermare la scrittura anche quando la policy
-- direbbe di si. Qui si vede quali sono attivi.
-- -----------------------------------------------------------------------------
select
  t.tgname as trigger_attivo,
  p.proname as funzione_chiamata
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.tasks'::regclass
  and not t.tgisinternal
order by t.tgname;

-- -----------------------------------------------------------------------------
-- 5. La prova vera: si crea un task e lo si toglie subito
--
-- Tutto quanto sopra e' un ragionamento; questo e' un fatto. Si prova a
-- inserire davvero un task per conto della prima persona attiva, si legge
-- l'esito, e si cancella la riga: alla fine il database e' come prima.
--
-- Questo e' l'unico punto del file che scrive, e cancella cio' che ha
-- scritto nella riga successiva. Se l'inserimento fallisce, non c'e'
-- nemmeno niente da cancellare.
--
-- Nota importante: qui si esegue come amministratore del database, quindi
-- la RLS non viene applicata. Un errore che compare QUI e' un problema di
-- struttura (colonna mancante, vincolo, trigger) e vale per tutti. Se
-- invece qui passa, il rifiuto che vedi nell'app viene dalla RLS, e la
-- risposta sta nel punto 2.
-- -----------------------------------------------------------------------------
do $$
declare
  chi uuid;
  prova uuid := gen_random_uuid();
begin
  select id into chi from public.profiles
  where is_active order by created_at limit 1;

  if chi is null then
    raise notice 'PROVA SALTATA: nessun profilo attivo nel workspace.';
    return;
  end if;

  begin
    insert into public.tasks (
      id, title, description, status, priority, owner_id, created_by,
      project_id, due_date, position, repeat, template_id, batch_id, parent_id
    ) values (
      prova, 'Prova tecnica, cancellata subito', null, 'todo',
      'normal', chi, chi, null, null, 0, 'none', null, null, null
    );

    delete from public.tasks where id = prova;

    raise notice 'ESITO: RIUSCITO. La struttura della tabella va bene e la riga di prova e stata rimossa. Se l app riceve un rifiuto, arriva dalla RLS: guarda il punto 2.';
  exception when others then
    -- Il sottoblocco annulla da se' l inserimento fallito.
    raise notice 'ESITO: FALLITO -- % : %', SQLSTATE, SQLERRM;
    raise notice 'Questo e un problema di struttura, non di permessi: vale per tutti, non solo per te.';
  end;
end;
$$;
