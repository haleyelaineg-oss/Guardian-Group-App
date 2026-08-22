-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration C
-- Adds a general expected-income log (retainers, grants, deals not
-- yet invoiced) — the income-side counterpart to the `expenses`
-- table from Migration B. The admin Income view combines this with
-- open invoice balances (documents) and event/itinerary income
-- (events.income_amount, event_itinerary_items.income_amount) into
-- one "all expected income" list — those other two sources already
-- have their own tables and aren't duplicated here.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js.
-- ============================================================

create table if not exists income (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'other', -- 'speaking' | 'training' | 'retainer' | 'grant' | 'consulting' | 'other'
  description text not null,
  amount      numeric not null default 0,
  expected_on date not null default current_date,
  status      text not null default 'expected', -- 'expected' | 'received'
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_income_expected_on on income(expected_on);

alter table income enable row level security;
create policy "staff all income" on income
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
