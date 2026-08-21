-- ============================================================
-- GUARDIAN GROUP — Address Book, Migration A
-- Adds a free-text Notes field to participants, used by the Address
-- Book's Add Contact / Edit Contact forms.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js.
-- ============================================================

alter table participants
  add column if not exists notes text;
