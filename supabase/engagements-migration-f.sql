-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration F (Stage 3)
-- Small additive columns for the new Post-Event (Speaking) /
-- Completion (Training) tabs. Everything else Stage 3 needs
-- (Sessions, Financials, Documents) reuses tables that already
-- exist — this is the only new schema for this stage.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after engagements-migration-a.sql.
-- ============================================================

alter table speaking_engagements
  add column if not exists recording_url  text,
  add column if not exists attendee_count integer,
  add column if not exists outcome_notes  text;

-- training_engagements.attendee_count already exists (Stage 1) and
-- means "expected" going into the training — actual_attendee_count
-- is a separate post-event field, not a rename/reuse of that one.
alter table training_engagements
  add column if not exists actual_attendee_count integer,
  add column if not exists outcome_notes         text;
