-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration E
-- Adds a street address and zip code to speaking_engagements,
-- split out from the single "venue" free-text field (now labeled
-- "Venue Name" in the UI) so the venue's mailing address can be
-- captured for travel planning without overloading one field.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after engagements-migration-a.sql.
-- ============================================================

alter table speaking_engagements
  add column if not exists venue_address text,
  add column if not exists zip_code      text;
