-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration A
-- Adds a general-purpose admin calendar: events (optionally linked
-- to a workshops row via nullable workshop_id, so a training date
-- can also appear on the calendar without duplicate entry), plus
-- per-event travel items and expenses.
--
-- Google Calendar sync is explicitly out of scope for this
-- migration — no google_event_id column yet. A future migration
-- can add one to `events` without touching this shape.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after quote-tool-migration-a.sql.
-- ============================================================

-- ============================================================
-- STEP 1: events
-- ============================================================
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_type    text not null default 'other',   -- 'workshop' | 'travel' | 'meeting' | 'other'
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  all_day       boolean not null default false,
  location      text,
  notes         text,
  workshop_id   uuid references workshops(id) on delete set null,
  company_id    uuid references companies(id) on delete set null,
  budget_amount numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_events_starts_at   on events(starts_at);
create index if not exists idx_events_workshop_id on events(workshop_id);
create index if not exists idx_events_company_id  on events(company_id);

-- keep updated_at current on edit
create or replace function public.touch_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
  before update on events
  for each row execute function public.touch_events_updated_at();

-- ============================================================
-- STEP 2: event_travel_items — one row per leg/booking (flight,
-- hotel, rental car, etc.) planned for an event.
-- ============================================================
create table if not exists event_travel_items (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references events(id) on delete cascade,
  item_type            text not null default 'other',  -- 'flight' | 'hotel' | 'car_rental' | 'other'
  description          text not null,
  provider             text,        -- airline / hotel chain / rental company
  confirmation_number  text,
  departs_at           timestamptz,
  arrives_at           timestamptz,
  cost                 numeric,
  status               text not null default 'planned', -- 'planned' | 'booked' | 'cancelled'
  notes                text,
  created_at           timestamptz not null default now()
);
create index if not exists idx_event_travel_items_event_id on event_travel_items(event_id);

-- ============================================================
-- STEP 3: event_expenses — real child table, not jsonb, because
-- (unlike documents.items, which an earlier migration comment notes
-- is "never queried by individual line") expenses need to be summed
-- by category/status and reported across events over time.
-- ============================================================
create table if not exists event_expenses (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  category     text not null default 'other', -- 'travel' | 'lodging' | 'meals' | 'materials' | 'venue' | 'other'
  description  text not null,
  amount       numeric not null default 0,
  status       text not null default 'planned', -- 'planned' | 'paid' | 'reimbursed'
  incurred_on  date,
  created_at   timestamptz not null default now()
);
create index if not exists idx_event_expenses_event_id on event_expenses(event_id);

-- ============================================================
-- STEP 4: RLS — staff-only, same posture as quote-tool-migration-a.sql
-- (the calendar is only ever reached through the logged-in admin
-- dashboard).
-- ============================================================
alter table events              enable row level security;
alter table event_travel_items  enable row level security;
alter table event_expenses      enable row level security;

create policy "staff all events" on events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all event_travel_items" on event_travel_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all event_expenses" on event_expenses
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
