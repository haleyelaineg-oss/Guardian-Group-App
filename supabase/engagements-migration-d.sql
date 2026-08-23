-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration D
-- Extends event_expenses with vendor/reimbursement tracking, needed
-- for Speaking/Training expense categories like airfare, mileage,
-- and reimbursable per-diems. `category` has never had a DB-level
-- constraint (it's purely a client-side dropdown, see
-- calendar-migration-a.sql) so the richer category list this
-- feature introduces (airfare, rental_car, mileage, parking,
-- baggage, ground_transportation, registration, childcare,
-- pet_care, printing, shipping, plus the existing travel/lodging/
-- meals/materials/venue/other) is a client-only change — nothing
-- to migrate here for that part.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-a.sql.
-- ============================================================

alter table event_expenses
  add column if not exists vendor              text,
  add column if not exists reimbursable         boolean not null default false,
  add column if not exists reimbursement_status text not null default 'not_applicable';
    -- 'not_applicable' | 'not_submitted' | 'submitted' | 'reimbursed' | 'denied'
