-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration C
-- Adds event_care_arrangements (childcare/pet care tracking, once
-- a real event exists) and extends event_itinerary_items with
-- speaking/training session metadata.
--
-- Session metadata is added directly to event_itinerary_items
-- rather than a separate child table — same call calendar-
-- migration-d.sql made when it merged event_travel_items into
-- event_itinerary_items specifically to keep one unified Itinerary
-- tab instead of two tables that need to be kept in sync. These
-- columns are nullable and only populated when item_type is
-- 'speaking_session' or 'training_session', same shape as the
-- existing LOGISTICS_TYPES/SESSION_TYPES split already governing
-- provider/cost/company_id/income_amount on this table.
--
-- No flight-number column is added — no reporting/filtering need
-- exists for it today (unlike status/category/item_type, which are
-- queried and aggregated), and putting it in the item's title (e.g.
-- "Departing Flight — WS 123") already makes it visible on chips
-- and tables. If that changes, `add column flight_number text` is
-- a one-line follow-up.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after engagements-migration-a.sql and
-- calendar-migration-h.sql (needs event_itinerary_items in its
-- current shape).
-- ============================================================

-- ============================================================
-- STEP 1: event_care_arrangements
-- ============================================================
create table if not exists event_care_arrangements (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  care_type   text not null, -- 'childcare' | 'petcare'
  starts_at   timestamptz,
  ends_at     timestamptz,
  provider    text,
  status      text not null default 'needed', -- 'needed' | 'arranging' | 'confirmed' | 'not_needed' | 'completed'
  cost        numeric,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_event_care_arrangements_event_id on event_care_arrangements(event_id);

alter table event_care_arrangements enable row level security;
create policy "staff all event_care_arrangements" on event_care_arrangements
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- STEP 2: speaking/training session metadata on
-- event_itinerary_items — only meaningful when item_type is
-- 'speaking_session' or 'training_session'.
-- ============================================================
alter table event_itinerary_items
  add column if not exists speakers            jsonb not null default '[]'::jsonb,
  add column if not exists session_type        text,
  add column if not exists description         text,
  add column if not exists learning_objectives text,
  add column if not exists av_requirements     text;
