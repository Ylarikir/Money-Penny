-- Money Penny – Supabase-tietokannan rakenne
-- Aja tämä kerran: Supabase → SQL Editor → New query → liitä → Run.

-- 1) Kaikki sovelluksen tiedot (sijoittajat, tehtävät, tapaamiset jne.)
create table if not exists public.mp_docs (
  collection  text        not null,
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (collection, id)
);

-- 2) Ketkä saavat käyttää sovellusta (sähköpostiosoitteet)
create table if not exists public.mp_members (
  email     text primary key,
  added_at  timestamptz not null default now()
);

-- 3) Apufunktio: onko kirjautunut käyttäjä listalla?
create or replace function public.mp_is_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mp_members
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 4) Käyttöoikeudet: vain listalla olevat näkevät ja muokkaavat dataa
alter table public.mp_docs    enable row level security;
alter table public.mp_members enable row level security;

drop policy if exists "members read"   on public.mp_docs;
drop policy if exists "members insert" on public.mp_docs;
drop policy if exists "members update" on public.mp_docs;
drop policy if exists "members delete" on public.mp_docs;
create policy "members read"   on public.mp_docs for select to authenticated using (public.mp_is_member());
create policy "members insert" on public.mp_docs for insert to authenticated with check (public.mp_is_member());
create policy "members update" on public.mp_docs for update to authenticated using (public.mp_is_member()) with check (public.mp_is_member());
create policy "members delete" on public.mp_docs for delete to authenticated using (public.mp_is_member());

drop policy if exists "see own membership" on public.mp_members;
create policy "see own membership" on public.mp_members for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 5) Reaaliaikaiset päivitykset (muiden muutokset näkyvät heti)
alter table public.mp_docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.mp_docs;
exception when duplicate_object then null;
end $$;

-- 6) Lisää itsesi ja tiimisi käyttäjiksi (vaihda osoitteet):
-- insert into public.mp_members (email) values
--   ('sinä@yritys.fi'),
--   ('kollega@yritys.fi');
