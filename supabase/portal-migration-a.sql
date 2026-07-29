-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration A
-- Additive schema changes, participant dedup, RLS setup.
-- Safe to run any time. Run BEFORE deploying the new js/register.js.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

-- ── Backup (cheap, drop these later once you're confident) ────
create table if not exists participants_backup_pre_portal as table participants;
create table if not exists registrations_backup_pre_portal as table registrations;
create table if not exists attendance_backup_pre_portal as table attendance;

-- ============================================================
-- STEP 1: Dedup participants by case-insensitive email
-- (Only touches rows with a non-blank email; keeps the oldest
-- row per email as canonical and repoints FKs from the rest.)
-- ============================================================
drop table if exists _dup_map;
create table _dup_map as
with ranked as (
  select
    id,
    lower(btrim(email)) as email_key,
    row_number() over (
      partition by lower(btrim(email))
      order by created_at asc nulls last, id asc
    ) as rn
  from participants
  where email is not null and btrim(email) <> ''
),
canonical as (
  select email_key, id as canonical_id from ranked where rn = 1
)
select r.id as dup_id, c.canonical_id
from ranked r
join canonical c on c.email_key = r.email_key
where r.rn > 1;

update registrations r set purchaser_id = m.canonical_id
from _dup_map m where r.purchaser_id = m.dup_id;

update attendance a set participant_id = m.canonical_id
from _dup_map m where a.participant_id = m.dup_id;

delete from participants p using _dup_map m where p.id = m.dup_id;

-- Sanity check — must return 0 rows before proceeding to STEP 2
select lower(btrim(email)), count(*) from participants
group by 1 having count(*) > 1;

drop table _dup_map;

-- ============================================================
-- STEP 2: New columns
-- ============================================================
alter table participants
  add column if not exists email_lower text generated always as (lower(btrim(email))) stored,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists participants_email_lower_key
  on participants (email_lower)
  where email_lower is not null and email_lower <> '';

create unique index if not exists participants_auth_user_id_key
  on participants (auth_user_id) where auth_user_id is not null;

create index if not exists idx_participants_company_id on participants(company_id);

alter table companies
  add column if not exists org_admin_participant_id uuid references participants(id) on delete set null;

-- ============================================================
-- STEP 3: attendance.status — real constraint
-- (If this errors on an existing constraint name, first run:
--  select conname from pg_constraint where conrelid = 'attendance'::regclass and contype = 'c';
--  and drop that constraint by its actual name instead.)
-- ============================================================
alter table attendance drop constraint if exists attendance_status_check;
alter table attendance
  add constraint attendance_status_check
  check (status in ('registered','attended','no_show','completed'));

create index if not exists idx_attendance_participant_workshop
  on attendance(participant_id, workshop_id);

-- ============================================================
-- STEP 4: certificate issuance on the EXISTING attendance columns
-- (certificate_issued, certificate_issued_at, certificate_number
-- already exist on `attendance` — discovered live on this project,
-- not part of the original inferred schema. Using them directly
-- instead of a separate certificates table avoids two competing
-- sources of truth for the same concept, and means the existing
-- attendance RLS policies already scope certificate visibility
-- correctly with no extra policies needed.)
-- ============================================================
create unique index if not exists attendance_certificate_number_key
  on attendance (certificate_number) where certificate_number is not null;

-- A certificate can only be marked issued once status is 'completed',
-- and once issued, auto-fills the number/timestamp if not already set.
-- Fires on INSERT too (not just UPDATE) — the open "insert attendance
-- during checkout" policy only checks status='registered', so without
-- this, certificate_issued=true could be smuggled in on the initial
-- insert, bypassing the completed-status requirement entirely.
create or replace function public.attendance_certificate_issuance()
returns trigger language plpgsql as $$
begin
  if new.certificate_issued is true and (TG_OP = 'INSERT' or old.certificate_issued is distinct from true) then
    if new.status is distinct from 'completed' then
      raise exception 'Cannot issue certificate: attendance status is % (must be completed)', coalesce(new.status, 'no status');
    end if;
    if new.certificate_issued_at is null then
      new.certificate_issued_at := now();
    end if;
    if new.certificate_number is null or new.certificate_number = '' then
      new.certificate_number := 'GG-' || to_char(now(), 'YYYY') || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_attendance_certificate_issuance on attendance;
create trigger trg_attendance_certificate_issuance
  before insert or update on attendance
  for each row execute function public.attendance_certificate_issuance();

-- ============================================================
-- STEP 5: staff identity + helper functions (SECURITY DEFINER
-- so they can be used inside RLS policies without recursion)
-- ============================================================
create table if not exists staff_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Bootstrap: today auth.users contains ONLY manually-provisioned staff
-- accounts (no client accounts exist yet) — safe to grab everyone.
-- Run this ONLY ONCE, before the account-auto-creation feature ships,
-- otherwise newly auto-created client accounts would incorrectly be
-- marked staff.
insert into staff_users (auth_user_id)
select id from auth.users
on conflict do nothing;

create or replace function public.is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from staff_users where auth_user_id = auth.uid());
$$;

create or replace function public.current_participant_id()
returns uuid language sql security definer stable set search_path = public as $$
  select id from participants where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_org_admin_for(target_company_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from companies c
    join participants p on p.id = c.org_admin_participant_id
    where c.id = target_company_id and p.auth_user_id = auth.uid()
  );
$$;

-- ============================================================
-- STEP 6: RPC for the registration flow's participant upsert
-- (SECURITY DEFINER — this is the ONLY path allowed to write to
-- participants from an anon/unauthenticated session.)
-- ============================================================
create or replace function public.upsert_participant_for_registration(
  p_full_name text, p_email text, p_company_id uuid
) returns participants
language plpgsql security definer set search_path = public as $$
declare v_row participants;
begin
  insert into participants (full_name, email, company_id)
  values (p_full_name, p_email, p_company_id)
  on conflict (email_lower) where email_lower is not null and email_lower <> ''
  do update set
    full_name  = excluded.full_name,
    company_id = coalesce(excluded.company_id, participants.company_id)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.upsert_participant_for_registration(text, text, uuid) to anon, authenticated;

-- ============================================================
-- STEP 7: Enable RLS + policies
-- ============================================================
alter table companies     enable row level security;
alter table participants  enable row level security;
alter table registrations enable row level security;
alter table attendance    enable row level security;

-- ============================================================
-- STEP 7a: Drop pre-existing policies discovered live on this
-- project (NOT part of the original inferred schema). These were
-- written back when only staff had Supabase Auth accounts, so a
-- couple are named narrowly but scoped broadly:
--
--   - "Admin can read all registrations" grants SELECT on
--     registrations to qual=true for ANY authenticated user, not
--     just staff. Harmless while only staff can log in; becomes a
--     cross-client data leak the moment client portal accounts
--     exist, since Postgres OR's all matching policies together —
--     it would silently override every scoped policy below.
--   - "Public can insert participants" already grants unrestricted
--     insert to public (anon+authenticated) — broader than, and
--     not covered by, the "TEMP" fallback policy's removal in
--     Migration B, which only drops a policy by that exact name.
--   - "Public can insert attendance" has no status restriction, so
--     anyone with the anon key could write status='completed'
--     directly, bypassing the staff-only completion model.
--   - "Public can insert companies" is a functional duplicate of
--     the replacement below — dropped for one clean policy set.
--
-- If these don't exist on your project (e.g. already cleaned up),
-- the IF EXISTS guards make this a no-op.
-- ============================================================
drop policy if exists "Admin can read all registrations" on registrations;
drop policy if exists "Public can insert participants" on participants;
drop policy if exists "Public can insert attendance" on attendance;
drop policy if exists "Public can insert companies" on companies;
drop policy if exists "Public can insert registrations" on registrations;

-- companies: unchanged from today's implicit behavior (low-sensitivity
-- fields, already reachable via anon key with no auth) — kept open for
-- read/insert so the existing register.js company-upsert keeps working.
create policy "read companies" on companies for select to anon, authenticated using (true);
create policy "insert companies during registration" on companies for insert to anon, authenticated with check (true);
create policy "staff can update companies" on companies for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- participants: NO anon/authenticated INSERT or UPDATE policy — all writes
-- from the registration flow now go through the RPC above, which bypasses
-- RLS by design. The TEMP policy below exists only so the OLD register.js
-- (blind insert) keeps working until the new code is deployed — drop it
-- via Migration B once that deploy is verified.
create policy "TEMP anon insert fallback — remove in Migration B"
  on participants for insert to anon with check (true);
create policy "individuals view own participant row" on participants for select to authenticated
  using (auth_user_id = auth.uid());
create policy "org admins view participants in their company" on participants for select to authenticated
  using (company_id is not null and public.is_org_admin_for(company_id));
create policy "staff view all participants" on participants for select to authenticated
  using (public.is_staff());
create policy "staff update participants" on participants for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- registrations: insert stays open (matches current behavior; no upsert
-- mechanics here so no attack surface change vs. today). Note: the
-- pre-existing "Public seat count anon can read workshop_id and
-- seats_purchased" policy is intentionally left in place — it's
-- unrelated to portal privacy (public seat-count display) and doesn't
-- conflict with the policies below.
create policy "insert registrations during checkout" on registrations for insert to anon, authenticated with check (true);
create policy "individuals view own registrations" on registrations for select to authenticated
  using (
    purchaser_id = public.current_participant_id()
    or exists (select 1 from attendance a where a.registration_id = registrations.id and a.participant_id = public.current_participant_id())
  );
create policy "org admins view company registrations" on registrations for select to authenticated
  using (purchaser_id in (select p.id from participants p where p.company_id is not null and public.is_org_admin_for(p.company_id)));
create policy "staff view all registrations" on registrations for select to authenticated using (public.is_staff());

-- attendance
create policy "insert attendance during checkout" on attendance for insert to anon, authenticated with check (status = 'registered');
create policy "individuals view own attendance" on attendance for select to authenticated
  using (participant_id = public.current_participant_id());
create policy "org admins view company attendance" on attendance for select to authenticated
  using (participant_id in (select p.id from participants p where p.company_id is not null and public.is_org_admin_for(p.company_id)));
create policy "staff view all attendance" on attendance for select to authenticated using (public.is_staff());
create policy "staff update attendance" on attendance for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Note: certificate_issued/certificate_issued_at/certificate_number live
-- on this same table, so the SELECT policies above already scope who can
-- see a participant's certificate data, and "staff update attendance"
-- above already covers staff issuing a certificate (UPDATE ... SET
-- certificate_issued = true) — no separate certificates-table policies
-- needed.
