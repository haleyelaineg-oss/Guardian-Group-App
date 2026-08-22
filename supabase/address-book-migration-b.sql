-- ============================================================
-- GUARDIAN GROUP — Address Book, Migration B
-- Multiple typed phone numbers per contact (participants), matching
-- the companies.phones pattern from Portal Migration E. Array of
-- {type, number} objects, e.g.
-- [{"type":"Office","number":"555-0100"},{"type":"Work Cell","number":"555-0101"}].
--
-- The existing single `phone` text column stays in place — the admin
-- UI keeps it in sync with the first phones[] entry so the client
-- roster table, address book search, and quote-tool client autofill
-- (which all still read participants.phone) keep working unchanged.
--
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

alter table participants add column if not exists phones jsonb not null default '[]'::jsonb;
