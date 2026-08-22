-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration I
-- Adds a top-level income amount to events, so income can be logged
-- when an event is created (a speaking fee for the event as a whole)
-- rather than only per itinerary item (event_itinerary_items already
-- has income_amount/income_source, from Migration B/H, for income
-- tied to a specific booking). The Spending tab totals both.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js.
-- ============================================================

alter table events add column if not exists income_amount numeric;
