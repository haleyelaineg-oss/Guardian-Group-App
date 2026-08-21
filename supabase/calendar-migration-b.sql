-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration B
-- Adds event_itinerary_items: sub-items ("Scheduled Events") that
-- live within a trip-level event's timeframe (e.g. a multi-day
-- trip spanning Feb 7-11 with "Driving To" / "Speaking Session" /
-- "Driving Home" itinerary entries on specific days/times). Each
-- item can optionally carry its own income amount, a link to an
-- invoice row in `documents` (doc_type = 'invoice'), and its own
-- client (company_id) - separate from the trip-level
-- events.company_id, since a single multi-purpose trip can touch
-- more than one client.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-a.sql.
-- ============================================================

create table if not exists event_itinerary_items (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  item_type      text not null default 'other', -- 'driving_to' | 'driving_home' | 'departing_flight' | 'return_flight' | 'speaking_session' | 'training_session' | 'other'
  title          text not null,
  starts_at      timestamptz,
  ends_at        timestamptz,
  location       text,
  notes          text,
  company_id     uuid references companies(id) on delete set null,
  income_amount  numeric,
  invoice_id     uuid references documents(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_event_itinerary_items_event_id on event_itinerary_items(event_id);

alter table event_itinerary_items enable row level security;

create policy "staff all event_itinerary_items" on event_itinerary_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
