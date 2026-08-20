-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration D
-- Address-book fields on participants + the staff write policies
-- the new admin "Address Book" UI needs (today participants has
-- no INSERT or DELETE policy at all — the only write path is the
-- upsert_participant_for_registration RPC from Migration A).
-- Additive only. Safe to run any time after Migration C.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

alter table participants
  add column if not exists phone text,
  add column if not exists title text,
  add column if not exists notes text;

create policy "staff insert participants" on participants
  for insert to authenticated with check (public.is_staff());
create policy "staff delete participants" on participants
  for delete to authenticated using (public.is_staff());
-- No ON DELETE CASCADE exists from attendance/registrations to
-- participants, so deleting a contact with training/registration
-- history will fail with a foreign-key error rather than silently
-- orphaning those rows — the admin UI should catch that and show a
-- friendly message instead of the raw Postgres error.
