-- Money Penny – osiokohtaiset käyttöoikeudet (Investor ja Sales)
-- Aja tämä kerran: Supabase → SQL Editor → New query → liitä → Run.
-- Nykyiset käyttäjät saavat automaattisesti molemmat osiot, joten mikään ei muutu ennen kuin rajaat jonkun.

-- 1) Kaksi oikeutta käyttäjälistaan
alter table public.mp_members add column if not exists can_investor boolean not null default true;
alter table public.mp_members add column if not exists can_sales    boolean not null default true;

-- 2) Saako kirjautunut käyttäjä käsitellä tätä tietotyyppiä?
--    Investor-osio: sijoittajat, kierros, sijoittajatehtävät, palaverit, aikajana ja historia.
--    Sales-osio: sidosryhmät, niiden palaverit ja seurannat, kaupat, tarjoukset ja myynnin seurannat.
--    Tiimilista (team) näkyy kaikille, joilla on oikeus jompaankumpaan osioon.
--    Tuntemattomat tietotyypit vaativat molemmat oikeudet.
create or replace function public.mp_can(coll text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mp_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and case
        when coll in ('investors','discussions','tasks','milestones','meetings','activity','round') then m.can_investor
        when coll in ('stakeholders','shlog','shtasks','shmeetings','deals','offers','dealtasks','deallog') then m.can_sales
        when coll = 'team' then (m.can_investor or m.can_sales)
        else m.can_investor and m.can_sales
      end
  );
$$;

-- 3) Korvataan vanhat säännöt osiokohtaisilla
drop policy if exists "members read"   on public.mp_docs;
drop policy if exists "members insert" on public.mp_docs;
drop policy if exists "members update" on public.mp_docs;
drop policy if exists "members delete" on public.mp_docs;
drop policy if exists "section read"   on public.mp_docs;
drop policy if exists "section insert" on public.mp_docs;
drop policy if exists "section update" on public.mp_docs;
drop policy if exists "section delete" on public.mp_docs;
create policy "section read"   on public.mp_docs for select to authenticated using (public.mp_can(collection));
create policy "section insert" on public.mp_docs for insert to authenticated with check (public.mp_can(collection));
create policy "section update" on public.mp_docs for update to authenticated using (public.mp_can(collection)) with check (public.mp_can(collection));
create policy "section delete" on public.mp_docs for delete to authenticated using (public.mp_can(collection));

-- 4) Esimerkkejä (poista rivin alusta -- ja vaihda osoite):
-- Uusi käyttäjä vain Sales-osioon:
--   insert into public.mp_members (email, can_investor, can_sales) values ('myyja@ioxio.com', false, true);
-- Uusi käyttäjä vain Investor-osioon:
--   insert into public.mp_members (email, can_investor, can_sales) values ('cfo@ioxio.com', true, false);
-- Rajaa olemassa olevalta käyttäjältä Investor-osio pois:
--   update public.mp_members set can_investor = false where email = 'kollega@ioxio.com';
-- Tarkista kaikkien oikeudet:
--   select email, can_investor, can_sales from public.mp_members order by email;
