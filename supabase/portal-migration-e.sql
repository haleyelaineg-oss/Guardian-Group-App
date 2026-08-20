`-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration E
-- Unlimited-seats option for company_membership + multiple typed
-- phone numbers on companies (for the client detail page's
-- Primary Contact section).
-- Additive/loosening only. Safe to run any time after Migration D.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

-- ============================================================
-- STEP 1: allow max_seats to be NULL, meaning "unlimited".
-- No trigger change needed — enforce_company_seat_limit() (Migration
-- C) already does `select max_seats into v_max ... if v_max is null
-- then return new;`, which already covers a NULL column value the
-- same way it covers "no membership row at all". The existing
-- `max_seats >= 0` check constraint is also unaffected — a NULL
-- value always passes a CHECK constraint under standard SQL
-- semantics, so no need to touch or drop it.
-- ============================================================
alter table company_membership alter column max_seats drop not null;

-- ============================================================
-- STEP 2: multiple typed phone numbers for a client's primary
-- contact. Array of {type, number} objects, e.g.
-- [{"type":"Office","number":"555-0100"},{"type":"Work Cell","number":"555-0101"}].
-- jsonb (not a separate table) to match the existing `items` column
-- on `documents` — this data is always read/written as a whole unit
-- from the client detail page, never queried by individual phone.
-- ============================================================
alter table companies add column if not exists phones jsonb not null default '[]'::jsonb;
`