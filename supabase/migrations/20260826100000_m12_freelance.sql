-- =============================================================================
-- Lacertosus Office OS -- migrazione M12: il ruolo "freelance"
--
-- Chi collabora a partita IVA non ha la settimana dell'ufficio: puo' lavorare
-- di sabato e riposare di mercoledi'. Il calendario delle assenze dava per
-- scontato il lunedi'-venerdi' e contava zero giorni su un weekend, cosi' un
-- freelance non riusciva nemmeno a segnare un sabato -- il pulsante restava
-- spento senza spiegare perche'.
--
-- Serve un terzo ruolo, e serve che sia un ruolo e non una casella a parte:
-- e' la stessa domanda ("che rapporto ha questa persona con l'ufficio?") e
-- avere due campi che rispondono insieme e' il modo migliore per farli
-- divergere.
--
-- Sui PERMESSI non cambia niente, ed e' voluto:
--   - `is_admin()` guarda `role = 'admin'`: un freelance non e' responsabile,
--     esattamente come un dipendente.
--   - `is_active_member()` guarda solo `is_active`: un freelance e' un membro
--     a pieno titolo, vede e lavora come gli altri.
-- Il ruolo cambia il CALENDARIO, non i poteri.
--
-- Regola del repo: additiva. M1-M11 non si toccano.
-- =============================================================================

alter table public.profiles
  drop constraint if exists profiles_role_valid;

alter table public.profiles
  add constraint profiles_role_valid check (role in ('admin', 'member', 'freelance'));

comment on column public.profiles.role is
  'admin = responsabile: approva, decide, gestisce. member = dipendente sulla settimana dell''ufficio. freelance = collaboratore senza settimana fissa: puo'' segnare assenze anche di sabato e domenica. Sui permessi freelance e member sono identici.';

-- -----------------------------------------------------------------------------
-- L'invariante resta quella: almeno un responsabile attivo
--
-- Il trigger profiles_guard (M9) la difende gia' contando i profili con
-- role = 'admin'. Un freelance non e' admin, quindi non puo' diventare
-- l'ultimo responsabile per sbaglio: nessuna modifica necessaria, ma vale la
-- pena averlo scritto -- e' il genere di cosa che si scopre rompendola.
-- -----------------------------------------------------------------------------
