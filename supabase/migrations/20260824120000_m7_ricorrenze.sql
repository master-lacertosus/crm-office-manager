-- =============================================================================
-- Lacertosus Office OS — migrazione M7: ricorrenze più fitte
--
-- Il vincolo ammetteva tre sole cadenze: settimanale, ogni due settimane,
-- mensile. Fuori restava tutto ciò che in un ufficio marketing si ripete
-- davvero ogni giorno — il controllo degli ordini, la pubblicazione sui
-- social, il presidio delle campagne — e chi ci provava doveva ricreare il
-- task a mano ogni mattina.
--
-- Si aggiungono cinque cadenze: quotidiana, nei soli giorni feriali, a giorni
-- alterni, trimestrale e annuale. «weekdays» non è un passo fisso in giorni:
-- il salto lo calcola l'applicazione (primo giorno feriale successivo), qui
-- serve solo che il valore sia ammesso.
--
-- I valori esistenti restano validi: nessun dato da convertire. Il vincolo
-- viene ricreato perché in PostgreSQL un CHECK non si allarga sul posto.
--
-- Regola del repo: additiva. M1–M6 non si toccano.
-- =============================================================================

alter table public.tasks
  drop constraint if exists tasks_repeat_valid;

alter table public.tasks
  add constraint tasks_repeat_valid check (
    repeat in (
      'none',
      'daily',
      'weekdays',
      'every_other_day',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly'
    )
  );

comment on column public.tasks.repeat is
  'Cadenza con cui il task si ricrea al completamento. «weekdays» = primo giorno feriale successivo (sabato e domenica saltati). La scadenza del nuovo giro non nasce mai nel passato: i giri già trascorsi vengono saltati.';

-- Gli stessi valori valgono per le attività ricorrenti del workspace: se il
-- template ammettesse cadenze che il task non può avere, il planner
-- creerebbe righe rifiutate dal vincolo qui sopra.
alter table public.workspace_templates
  drop constraint if exists template_repeat_valid;

alter table public.workspace_templates
  add constraint template_repeat_valid check (
    repeat in (
      'none',
      'daily',
      'weekdays',
      'every_other_day',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly'
    )
  );
