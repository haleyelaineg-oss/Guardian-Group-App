-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration F
-- Staff delete access on companies, for the new "Delete" button on
-- the Clients list. No DELETE policy exists on companies today —
-- only select/insert (open) and staff-only update (Migration A).
--
-- No cascade changes needed: company_membership already cascades
-- (Migration C, `on delete cascade`) and quote_clients already
-- nulls out on delete (quote-tool-migration-a.sql). participants
-- has no ON DELETE behavior defined on its company_id FK, so
-- deleting a company that still has contacts/registrants on file
-- will fail with a foreign-key error rather than silently orphaning
-- or cascading them — the admin UI surfaces that as a friendly
-- "remove their contacts first" message.
--
-- Additive only. Safe to run any time after Migration E.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

create policy "staff delete companies" on companies
  for delete to authenticated using (public.is_staff());
