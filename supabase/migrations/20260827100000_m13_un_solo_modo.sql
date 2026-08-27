-- =============================================================================
-- Lacertosus Office OS -- migrazione M13: un solo modo di dire "ha dei pezzi"
--
-- Il workspace aveva due modi di esprimere la stessa idea:
--
--   batch_id   i task nati insieme da un template a fasi, fratelli fra loro
--   parent_id  i pezzi di un lavoro, con un padre
--
-- Due modi per la stessa idea significa scrivere ogni funzionalita' futura
-- due volte, e vederli divergere al primo che ci si dimentica. Nei dati non
-- c'era nemmeno un task con batch_id: il doppione esisteva solo nel codice,
-- e questo e' il momento buono per toglierlo senza compromessi.
--
-- Da ora un template a fasi crea UN LAVORO con i suoi pezzi: "Creazione
-- prodotto" con dentro "Scrittura testi" e "Caricamento online". E' anche il
-- modo in cui la cosa viene descritta a voce.
--
-- La colonna NON viene cancellata: la regola del repo e' additiva, e togliere
-- una colonna non si disfa. Qui si scrive solo che nessuno la usa piu', dove
-- il prossimo che apre lo schema lo leggera'.
--
-- Regola del repo: additiva. M1-M12 non si toccano.
-- =============================================================================

comment on column public.tasks.batch_id is
  'NON PIU'' USATA (M13). Raggruppava i task nati insieme da un template a fasi. Sostituita da parent_id: un template crea un lavoro con i suoi pezzi, che e'' lo stesso modo in cui funzionano i sotto-task. Nessuna riga la valorizza; resta qui perche'' cancellare una colonna non si disfa.';

comment on column public.tasks.parent_id is
  'Il lavoro di cui questo task e'' un pezzo. NULL = lavoro principale. Un solo livello: un pezzo non ha pezzi. Da M13 e'' l''unico modo di esprimere "questo lavoro ha dei pezzi", per i sotto-task e per i template a fasi.';
