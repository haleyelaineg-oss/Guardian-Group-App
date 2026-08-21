-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration B
-- Adds a general business expense tracker (rent, software,
-- insurance, etc.) — distinct from event_expenses, which is
-- scoped to a specific calendar trip/event.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js.
-- ============================================================

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'other', -- 'software' | 'office' | 'marketing' | 'insurance' | 'professional_services' | 'travel' | 'meals' | 'equipment' | 'other'
  description text not null,
  amount      numeric not null default 0,
  incurred_on date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_expenses_incurred_on on expenses(incurred_on);

alter table expenses enable row level security;
create policy "staff all expenses" on expenses
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
