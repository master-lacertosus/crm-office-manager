-- =============================================================================
-- Lacertosus Office OS -- migrazione M18: chi esce e rientra
--
-- COSA FARE: apri Supabase, "SQL Editor", incolla tutto questo file, "Run".
-- Si puo' eseguire due volte senza danno: rifa' soltanto cio' che manca.
--
-- -----------------------------------------------------------------------------
--
-- IL DIFETTO, segnalato un'ora dopo aver acceso M16. Si timbra l'entrata, si
-- timbra l'uscita, e poi si rientra -- dopo pranzo, dopo una commissione, la
-- sera. Il terzo tocco provava a creare una SECONDA riga per lo stesso giorno
-- e sbatteva contro `timbrature_una_per_giorno`:
--
--   duplicate key value violates unique constraint "timbrature_una_per_giorno"
--
-- M16 diceva gia' la cosa giusta -- "chi esce e rientra non apre una riga
-- nuova: corregge la sua" -- ma quella frase era rimasta un commento. Il
-- codice inseriva sempre.
--
-- LA CURA STA NEL CLIENT (riapre la giornata invece di crearne una). Qui
-- serve solo il pezzo che il client da solo non puo' avere: sapere se la
-- pausa e' STATA MISURATA o e' ancora quella presunta.
--
-- PERCHE' SERVE. Il valore di serie e' un'ora, pensato per chi non timbra il
-- pranzo. Ma chi ESCE e RIENTRA la pausa la sta misurando davvero, e allora
-- l'ora presunta va buttata, non sommata -- o si conterebbe due volte. Al
-- rientro successivo invece si somma, perche' le pause misurate sono due.
-- Senza questo flag le due situazioni sono indistinguibili, e il numero piu'
-- visibile della pagina sarebbe sbagliato di un'ora senza dirlo.
--
-- Regola del repo: additiva. M1-M17 non si toccano.
-- =============================================================================

begin;

alter table public.timbrature
  add column if not exists pausa_misurata boolean not null default false;

comment on column public.timbrature.pausa_misurata is
  'M18: true quando la pausa viene da un''uscita e un rientro veri, false quando e'' ancora l''ora presunta. Al primo rientro l''ora presunta si sostituisce; ai successivi si somma.';

commit;

-- =============================================================================
-- Nota: nessuna policy nuova. La tabella e' gia' coperta da quelle di M16
-- (`timbrature_update_proprie`), che valgono su tutte le colonne: una colonna
-- aggiunta non apre nulla a nessuno.
-- =============================================================================
