-- ============================================================
-- GUARDIAN GROUP — Security Hardening, Migration A
-- Full-project RLS review, 2026-08-21. Fixes issues found while
-- auditing every table's policies against what the app code
-- actually needs. Additive/tightening only — nothing here removes
-- functionality any current page relies on (verified against
-- js/*.js before writing each step).
--
-- Also run (separately, already existed, never applied):
--   supabase/portal-migration-b.sql
-- It drops the "TEMP anon insert fallback" policy on `participants`
-- that the old register.js needed. The new register.js (already
-- live, uses the upsert_participant_for_registration RPC) doesn't
-- need it — leaving it open just widens the write surface on that
-- table for no reason.
--
-- Run this whole file in the Supabase SQL editor for the project
-- used by js/config.js. Safe to run any time after
-- quote-tool-migration-a.sql.
-- ============================================================

-- ============================================================
-- STEP 1 (CRITICAL): staff_users had RLS disabled entirely — not
-- missing a policy, OFF. With RLS off, the anon/authenticated table
-- grants Supabase creates by default (SELECT/INSERT/UPDATE/DELETE)
-- apply with zero row restriction. Since is_staff() everywhere in
-- this app just checks "does a row in staff_users exist for
-- auth.uid()", ANYONE with the public anon key could INSERT their
-- own auth_user_id into this table and grant themselves full staff
-- access — delete companies, read every participant/attendance
-- record, and now every quote/invoice/document too. This is a
-- complete admin-privilege-escalation hole and is the highest
-- priority fix in this file.
--
-- No policies are added on purpose: nothing in the app ever needs
-- to read/write staff_users through the API — is_staff() is
-- SECURITY DEFINER and already bypasses RLS to check it internally.
-- Enabling RLS with zero policies blocks ALL anon/authenticated API
-- access; management stays in the SQL editor / dashboard only.
-- ============================================================
alter table staff_users enable row level security;

-- ============================================================
-- STEP 2: three pre-portal backup tables (participants_backup_
-- pre_portal, registrations_backup_pre_portal, attendance_backup_
-- pre_portal) also had RLS disabled entirely, exposing old
-- participant/registration PII and payment data to the anon key.
-- No app code references them (grepped js/*.js — zero hits), so
-- this locks them to staff-only without touching anything live.
-- If you're confident they're no longer needed at all, dropping
-- them is a cleaner fix than this — your call, ask me to do that
-- instead if so.
-- ============================================================
alter table participants_backup_pre_portal   enable row level security;
alter table registrations_backup_pre_portal  enable row level security;
alter table attendance_backup_pre_portal     enable row level security;

create policy "staff all participants_backup_pre_portal" on participants_backup_pre_portal
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all registrations_backup_pre_portal" on registrations_backup_pre_portal
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all attendance_backup_pre_portal" on attendance_backup_pre_portal
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- STEP 3: pre_survey_responses / post_survey_responses /
-- quiz_responses / training_records all had "qual: true" SELECT
-- policies for role `authenticated` — not staff-only. Since portal
-- client logins are also `authenticated`, any org admin or portal
-- member could read every attendee's survey answers, quiz scores,
-- and training history across every OTHER company on the platform,
-- not just their own. Only js/admin.js (staff-only surface) reads
-- any of these tables today — confirmed no portal-facing code
-- touches them — so restricting SELECT to staff is a pure
-- tightening with no functional change.
--
-- (post_survey_responses, quiz_responses, and training_records also
-- currently have zero app code writing to them and zero rows — they
-- look like not-yet-built features. Leaving their public INSERT
-- policies as-is since I don't know your plans for them; flagged in
-- my summary if you want to lock those down too.)
-- ============================================================
drop policy "Authenticated can read pre-survey responses" on pre_survey_responses;
create policy "staff read pre-survey responses" on pre_survey_responses
  for select to authenticated using (public.is_staff());

drop policy "Authenticated can read post-survey responses" on post_survey_responses;
create policy "staff read post-survey responses" on post_survey_responses
  for select to authenticated using (public.is_staff());

drop policy "Authenticated can read quiz responses" on quiz_responses;
create policy "staff read quiz responses" on quiz_responses
  for select to authenticated using (public.is_staff());

drop policy "Authenticated can read training records" on training_records;
create policy "staff read training records" on training_records
  for select to authenticated using (public.is_staff());

-- ============================================================
-- STEP 4: the "Public seat count anon..." policy on `registrations`
-- is named for two columns but RLS can only restrict rows, not
-- columns — it actually grants anon SELECT * on every registration,
-- including total_paid, square_transaction_id, and square_order_id
-- for every purchase ever made. js/workshops.js (the public site) is
-- the only anon reader and only ever asks for workshop_id +
-- seats_purchased, so a column-scoped view replaces it without
-- changing behavior there.
--
-- Companion code change (already made): js/workshops.js now reads
-- from this view instead of the `registrations` table directly.
-- Run this migration BEFORE that code goes live, or the public
-- workshop page's seat counts will briefly error.
-- ============================================================
create view public.registration_seat_counts
  with (security_invoker = false) as
  select workshop_id, seats_purchased from registrations;

grant select on public.registration_seat_counts to anon, authenticated;

drop policy "Public seat count anon can read workshop_id and seats_purchased" on registrations;

-- ============================================================
-- STEP 5: next_doc_number() is SECURITY DEFINER, so it bypasses the
-- staff-only RLS on doc_number_counters/documents entirely — and it
-- was still executable by the `anon` role (default PUBLIC grant on
-- newly created functions was never revoked). That let anyone
-- unauthenticated burn through your Q-/INV-/R- number sequence with
-- no login at all. Revoking PUBLIC and adding an explicit is_staff()
-- check closes both the anon hole and the "any logged-in portal
-- user, not just staff" gap.
-- ============================================================
revoke execute on function public.next_doc_number(text) from public;
grant execute on function public.next_doc_number(text) to authenticated;

create or replace function public.next_doc_number(p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_num integer;
  v_prefix text;
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;
  update doc_number_counters set next_number = next_number + 1
    where doc_type = p_type
    returning next_number - 1 into v_num;
  if v_num is null then
    insert into doc_number_counters (doc_type, next_number) values (p_type, 2)
      returning next_number - 1 into v_num;
  end if;
  v_prefix := case p_type when 'quote' then 'Q' when 'invoice' then 'INV' when 'receipt' then 'R' else upper(p_type) end;
  return v_prefix || '-' || lpad(v_num::text, 4, '0');
end;
$$;

-- ============================================================
-- STEP 6: hygiene — four trigger functions had no `search_path`
-- set, which the Supabase linter flags because an unset search_path
-- is technically hijackable by a user with schema-create rights.
-- None of these are SECURITY DEFINER and none are directly callable
-- via the API (trigger functions only), so real exploitability here
-- is low, but it's a one-line fix with zero behavior change.
-- ============================================================
alter function public.attendance_certificate_issuance() set search_path = public;
alter function public.enforce_company_seat_limit()       set search_path = public;
alter function public.touch_events_updated_at()           set search_path = public;
alter function public.link_quote_client_to_company()      set search_path = public;
