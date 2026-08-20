-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration C
-- Client-code self-serve signup + seat-limited membership +
-- org-admin self-service member removal.
-- Additive only. Safe to run any time after Migration B.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

-- ============================================================
-- STEP 1: company_membership — sensitive membership fields live
-- HERE, not on `companies`, because `companies` has:
--   create policy "read companies" on companies for select
--     to anon, authenticated using (true);
-- i.e. the entire companies table is publicly readable via the
-- anon key by design (it backs the open workshop-checkout flow).
-- Putting client_code/max_seats directly on companies would make
-- every client's signup code readable by anyone hitting the
-- Supabase REST endpoint. This table gets NO anon/authenticated
-- SELECT policy at all — staff-session and service-role only.
-- ============================================================
create table if not exists company_membership (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  client_code      text not null,
  membership_tier  text,
  max_seats        integer not null default 5,
  created_at       timestamptz not null default now(),
  constraint company_membership_company_id_key unique (company_id),
  constraint company_membership_client_code_key unique (client_code),
  constraint company_membership_client_code_upper check (client_code = upper(client_code)),
  constraint company_membership_max_seats_check check (max_seats >= 0)
);

-- Backfill: every existing company gets a membership row so the
-- admin UI never has to special-case "row doesn't exist yet".
-- Codes generated here are throwaway hex — staff should hit
-- "Regenerate" once from the admin Companies tab to get a cleaner
-- code from the app's nicer alphabet (see generateClientCode() in
-- js/admin.js).
insert into company_membership (company_id, client_code, max_seats)
select c.id,
       upper(substr(md5(c.id::text || clock_timestamp()::text || random()::text), 1, 8)),
       5
from companies c
where not exists (select 1 from company_membership m where m.company_id = c.id)
on conflict (company_id) do nothing;

-- ============================================================
-- STEP 2: participants.is_active — tracks live portal membership
-- separately from auth_user_id, so removal can clear the login
-- without destroying historical attendance/registrations rows
-- (which reference participant_id, not auth_user_id).
--
-- "Active seat" = is_active AND auth_user_id is not null. A
-- participant who only ever registered for a workshop, never a
-- portal account, doesn't consume a company seat regardless of
-- this flag.
-- ============================================================
alter table participants
  add column if not exists is_active boolean not null default true;

create index if not exists idx_participants_active_seat
  on participants (company_id)
  where is_active and auth_user_id is not null;

-- ============================================================
-- STEP 3: seat-limit enforcement at the DB level, not just in
-- netlify/functions/portal-signup.js. The function pre-checks
-- seat count before creating the auth user, but two concurrent
-- signups could both pass that check before either commits
-- (TOCTOU race). This trigger re-validates on the actual write
-- that consumes a seat, closing the race regardless of caller.
-- Companies with no company_membership row (shouldn't happen
-- post-backfill) are left unlimited.
-- ============================================================
create or replace function public.enforce_company_seat_limit()
returns trigger language plpgsql as $$
declare
  v_max   integer;
  v_count integer;
begin
  if new.company_id is null or new.auth_user_id is null or new.is_active is not true then
    return new;
  end if;
  -- No change in seat consumption on this row — skip recount.
  if TG_OP = 'UPDATE'
     and old.company_id = new.company_id
     and old.auth_user_id is not null
     and old.is_active is true then
    return new;
  end if;

  select max_seats into v_max from company_membership where company_id = new.company_id;
  if v_max is null then
    return new; -- no membership row — unlimited
  end if;

  select count(*) into v_count from participants
    where company_id = new.company_id
      and is_active
      and auth_user_id is not null
      and id <> new.id;

  if v_count >= v_max then
    raise exception 'SEAT_LIMIT_REACHED: company % has reached its % seat limit', new.company_id, v_max;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_company_seat_limit on participants;
create trigger trg_enforce_company_seat_limit
  before insert or update on participants
  for each row execute function public.enforce_company_seat_limit();

-- ============================================================
-- STEP 4: RLS on company_membership
-- ============================================================
alter table company_membership enable row level security;

create policy "staff view company_membership" on company_membership
  for select to authenticated using (public.is_staff());
create policy "staff insert company_membership" on company_membership
  for insert to authenticated with check (public.is_staff());
create policy "staff update company_membership" on company_membership
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete company_membership" on company_membership
  for delete to authenticated using (public.is_staff());
-- No anon/authenticated-non-staff policy of any kind — default
-- deny. netlify/functions/portal-signup.js reads/writes this table
-- via the SERVICE ROLE key, which bypasses RLS entirely, so signup
-- works without any client-facing SELECT policy ever existing.

-- ============================================================
-- STEP 5: org_admin_seat_status — lets the portal's Company view
-- show "X of Y seats used" without ever opening company_membership
-- to authenticated users generally. SECURITY DEFINER, same pattern
-- as is_org_admin_for() in Migration A.
-- ============================================================
create or replace function public.org_admin_seat_status(p_company_id uuid)
returns table(active_count integer, max_seats integer, membership_tier text)
language plpgsql security definer stable set search_path = public as $$
begin
  if not (public.is_org_admin_for(p_company_id) or public.is_staff()) then
    raise exception 'Not authorized';
  end if;
  return query
    select
      (select count(*)::int from participants p
         where p.company_id = p_company_id and p.is_active and p.auth_user_id is not null),
      m.max_seats,
      m.membership_tier
    from company_membership m
    where m.company_id = p_company_id;
end;
$$;
grant execute on function public.org_admin_seat_status(uuid) to authenticated;
