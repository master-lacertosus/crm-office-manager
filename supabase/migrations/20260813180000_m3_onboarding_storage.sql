-- =============================================================================
-- Lacertosus Office OS — migrazione M3: primo accesso guidato e foto profilo
--
-- Due cose:
--  1. sapere se un profilo è già stato configurato dal suo proprietario;
--  2. un posto vero dove tenere le foto, al posto delle data URL nel browser.
--
-- Regola del repo: additiva. M1 e M2 non si toccano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Primo accesso
--
-- Serve una marcatura esplicita. Dedurre «non ancora configurato» dal nome
-- («somiglia alla parte prima della chiocciola?») sarebbe fragile e
-- riproporrebbe la procedura a chi si chiama davvero come la sua email.
-- Con una colonna si sa anche quando è stata completata, e si può rimandare
-- senza che l'app insista a ogni accesso.
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'Quando il proprietario ha completato il primo accesso guidato. NULL = mai.';

-- -----------------------------------------------------------------------------
-- 2. Deposito delle foto profilo
--
-- Bucket PUBBLICO in lettura. La scelta merita una parola: le foto vengono
-- mostrate ovunque nell'app (schede, commenti, elenchi) e un bucket privato
-- imporrebbe URL firmati a scadenza, che complicano la cache delle immagini
-- e vanno rigenerati di continuo. Il percorso contiene l'id utente e un nome
-- casuale, quindi non è indovinabile; resta il fatto che chi conosce un URL
-- può vederlo. Per delle foto profilo aziendali è il compromesso normale
-- (lo fanno Slack e Notion), ma se un domani serve stringere basta portare
-- `public` a false e passare agli URL firmati.
--
-- La scrittura invece è ristretta: ognuno tocca solo la propria cartella.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB: una foto profilo non ha motivo di pesare di più
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Le policy su storage.objects vanno create una volta sola: `create policy`
-- non ha `if not exists`, quindi si eliminano prima per rendere la
-- migrazione rieseguibile senza errori.
drop policy if exists avatars_read_all on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

-- Lettura: chiunque. Coerente con il bucket pubblico — negarla qui mentre il
-- bucket è pubblico darebbe solo l'illusione di una protezione.
create policy avatars_read_all
  on storage.objects for select
  using (bucket_id = 'avatars');

/* Scrittura: solo nella propria cartella. Il percorso è
   «<id utente>/<nome file>», e `storage.foldername(name)` ne restituisce i
   segmenti: il primo deve corrispondere all'utente collegato. Senza questo
   vincolo chiunque potrebbe sostituire la foto di un collega. */
create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
