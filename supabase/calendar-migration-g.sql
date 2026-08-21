-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration G
-- Adds: a Task Owner field (defaults to Unassigned; Dave/Haley are
-- the only other options for now — add more later by editing the
-- <select> in admin/index.html, no schema change needed since this
-- is a free-text column), and a general-purpose Link (URL) field
-- on tasks, events, and itinerary items.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-f.sql.
-- ============================================================

alter table tasks
  add column if not exists owner text not null default 'Unassigned',
  add column if not exists link_url text;

alter table events
  add column if not exists link_url text;

alter table event_itinerary_items
  add column if not exists link_url text;
