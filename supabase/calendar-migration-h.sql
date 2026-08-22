-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration H
-- Adds a free-text "Income Source" label to itinerary items, so
-- income (e.g. a speaking stipend) can be logged and labeled
-- without requiring a linked invoice — income_amount and
-- invoice_id were already independent fields, this just makes it
-- clear what an income entry actually was for at a glance.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-g.sql.
-- ============================================================

alter table event_itinerary_items
  add column if not exists income_source text;
