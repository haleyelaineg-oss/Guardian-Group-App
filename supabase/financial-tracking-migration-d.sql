-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration D
-- Separates the tax/reporting expense category from Guardian Group's
-- more specific internal expense type. Existing records remain readable:
-- their previous category is copied to expense_type before category is
-- backfilled to its standardized accounting classification.
-- ============================================================

alter table event_expenses add column if not exists expense_type text;
alter table expenses add column if not exists expense_type text;
alter table expenses add column if not exists status text not null default 'paid';
alter table event_expenses add column if not exists tax_treatment text not null default 'needs_review';
alter table expenses add column if not exists tax_treatment text not null default 'needs_review';

update event_expenses
set expense_type = category
where expense_type is null or expense_type = '';

update expenses
set expense_type = category
where expense_type is null or expense_type = '';

update event_expenses
set category = case expense_type
  when 'airfare' then 'travel' when 'lodging' then 'travel' when 'rental_car' then 'travel' when 'mileage' then 'travel' when 'parking' then 'travel' when 'tolls' then 'travel' when 'ground_transportation' then 'travel' when 'fuel' then 'fuel'
  when 'meals' then 'meals' when 'client_meal' then 'meals'
  when 'marketing' then 'advertising' when 'social_media_advertising' then 'advertising'
  when 'materials' then 'supplies' when 'training_materials' then 'supplies'
  when 'venue' then 'rent_lease' when 'printing' then 'office_expense' when 'shipping' then 'office_expense' when 'software' then 'office_expense' when 'office' then 'office_expense'
  when 'insurance' then 'insurance' when 'general_liability' then 'insurance'
  when 'professional_services' then 'legal_professional_services' when 'accounting' then 'legal_professional_services'
  when 'equipment' then 'depreciation_section_179' else 'other_business_expense'
end;

update expenses
set category = case expense_type
  when 'travel' then 'travel' when 'fuel' then 'fuel' when 'meals' then 'meals' when 'marketing' then 'advertising' when 'insurance' then 'insurance'
  when 'professional_services' then 'legal_professional_services' when 'software' then 'office_expense' when 'office' then 'office_expense'
  when 'equipment' then 'depreciation_section_179' else 'other_business_expense'
end;

update expenses set status = 'paid' where status is null or status = '';

alter table event_expenses alter column expense_type set default 'other';
alter table event_expenses alter column expense_type set not null;
alter table expenses alter column expense_type set default 'other';
alter table expenses alter column expense_type set not null;

-- Mileage remains independent from cash expenses. Rates are stored by tax year
-- so the deduction can be calculated without changing the source miles.
create table if not exists mileage_rates (
  effective_date date primary key,
  dollars_per_mile numeric(6,3) not null check (dollars_per_mile >= 0),
  created_at timestamptz not null default now()
);
insert into mileage_rates (effective_date, dollars_per_mile)
values ('2026-07-01', 0.760)
on conflict (effective_date) do update set dollars_per_mile = excluded.dollars_per_mile;
create table if not exists event_mileage_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  travelled_on date not null default current_date,
  vehicle text,
  starting_location text,
  destination text,
  business_purpose text,
  starting_odometer numeric(12,1),
  ending_odometer numeric(12,1),
  business_miles numeric(10,2) not null check (business_miles >= 0),
  round_trip boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_event_mileage_entries_event_id on event_mileage_entries(event_id);
alter table mileage_rates enable row level security;
alter table event_mileage_entries enable row level security;
create policy "staff all mileage rates" on mileage_rates for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all event mileage entries" on event_mileage_entries for all to authenticated using (public.is_staff()) with check (public.is_staff());
