-- Canonical Income architecture: income is the economic source of value;
-- documents bill it and payments collect it. This migration is additive and
-- deliberately creates reconciliation candidates instead of merging legacy
-- event/itinerary/invoice amounts automatically.

alter table income
  add column if not exists certainty_status text,
  add column if not exists income_kind text,
  add column if not exists currency_code text not null default 'USD',
  add column if not exists company_id uuid references companies(id) on delete set null,
  add column if not exists source_type text not null default 'manual',
  add column if not exists event_id uuid references events(id) on delete set null,
  add column if not exists training_engagement_id uuid references training_engagements(id) on delete set null,
  add column if not exists speaking_engagement_id uuid references speaking_engagements(id) on delete set null,
  add column if not exists itinerary_item_id uuid references event_itinerary_items(id) on delete set null,
  add column if not exists legacy_document_id uuid references documents(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update income
set certainty_status = coalesce(certainty_status, case when status in ('expected', 'received') then 'confirmed' else 'potential' end),
    income_kind = coalesce(income_kind, case when category in ('speaking', 'training', 'consulting') then 'service_revenue' else 'other_income' end);

alter table income
  alter column certainty_status set not null,
  alter column certainty_status set default 'potential',
  alter column income_kind set not null,
  alter column income_kind set default 'service_revenue';

alter table income drop constraint if exists income_certainty_status_check;
alter table income add constraint income_certainty_status_check check (certainty_status in ('potential', 'confirmed', 'cancelled'));
alter table income drop constraint if exists income_income_kind_check;
alter table income add constraint income_income_kind_check check (income_kind in ('service_revenue', 'reimbursement', 'other_income'));
alter table income drop constraint if exists income_currency_code_check;
alter table income add constraint income_currency_code_check check (currency_code ~ '^[A-Z]{3}$');
alter table income drop constraint if exists income_source_shape_check;
alter table income add constraint income_source_shape_check check (
  (source_type = 'manual' and event_id is null and training_engagement_id is null and speaking_engagement_id is null and itinerary_item_id is null)
  or (source_type = 'event' and event_id is not null and training_engagement_id is null and speaking_engagement_id is null and itinerary_item_id is null)
  or (source_type = 'training' and event_id is null and training_engagement_id is not null and speaking_engagement_id is null and itinerary_item_id is null)
  or (source_type = 'speaking' and event_id is null and training_engagement_id is null and speaking_engagement_id is not null and itinerary_item_id is null)
  or (source_type = 'itinerary' and event_id is null and training_engagement_id is null and speaking_engagement_id is null and itinerary_item_id is not null)
);

create index if not exists idx_income_company_id on income(company_id);
create index if not exists idx_income_certainty_status on income(certainty_status);
create index if not exists idx_income_event_id on income(event_id);
create index if not exists idx_income_training_engagement_id on income(training_engagement_id);
create index if not exists idx_income_speaking_engagement_id on income(speaking_engagement_id);
create index if not exists idx_income_itinerary_item_id on income(itinerary_item_id);
create unique index if not exists idx_income_legacy_document_id on income(legacy_document_id) where legacy_document_id is not null;

create or replace function public.touch_income_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_income_updated_at on income;
create trigger trg_income_updated_at before update on income for each row execute function public.touch_income_updated_at();

create table if not exists income_document_links (
  id uuid primary key default gen_random_uuid(),
  income_id uuid not null references income(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  allocated_amount numeric not null check (allocated_amount >= 0),
  created_at timestamptz not null default now(),
  unique (income_id, document_id)
);
create index if not exists idx_income_document_links_document_id on income_document_links(document_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null check (amount > 0),
  direction text not null default 'received' check (direction in ('received', 'refund')),
  received_at timestamptz not null default now(),
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  income_id uuid not null references income(id) on delete restrict,
  document_id uuid references documents(id) on delete restrict,
  allocated_amount numeric not null check (allocated_amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_allocations_income_id on payment_allocations(income_id);
create index if not exists idx_payment_allocations_document_id on payment_allocations(document_id);

create or replace function public.require_invoice_payment_allocation() returns trigger language plpgsql as $$
begin
  if new.document_id is not null and not exists (select 1 from documents where id = new.document_id and doc_type = 'invoice') then
    raise exception 'Payments may only be allocated to invoice documents';
  end if;
  return new;
end; $$;
drop trigger if exists trg_require_invoice_payment_allocation on payment_allocations;
create trigger trg_require_invoice_payment_allocation before insert or update of document_id on payment_allocations for each row execute function public.require_invoice_payment_allocation();

create table if not exists income_reconciliation_candidates (
  id uuid primary key default gen_random_uuid(),
  left_income_id uuid not null references income(id) on delete cascade,
  right_income_id uuid not null references income(id) on delete cascade,
  match_basis text not null,
  status text not null default 'pending' check (status in ('pending', 'same_income', 'separate_income', 'dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (left_income_id, right_income_id),
  check (left_income_id <> right_income_id)
);

alter table income enable row level security;
alter table income_document_links enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;
alter table income_reconciliation_candidates enable row level security;
create policy "staff all income document links" on income_document_links for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all payments" on payments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all payment allocations" on payment_allocations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all income reconciliation candidates" on income_reconciliation_candidates for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Backfill each legacy source independently. Matching candidates below require
-- staff review; nothing is merged by this migration.
insert into income (category, description, amount, expected_on, status, notes, certainty_status, income_kind, company_id, source_type, event_id)
select 'other', e.title, e.income_amount, e.starts_at::date, 'expected', 'Migrated from events.income_amount', case when e.status = 'cancelled' then 'cancelled' else 'confirmed' end, 'service_revenue', e.company_id, 'event', e.id
from events e where e.income_amount is not null and not exists (select 1 from income i where i.event_id = e.id);

insert into income (category, description, amount, expected_on, status, notes, certainty_status, income_kind, company_id, source_type, itinerary_item_id)
select 'other', i.title, i.income_amount, coalesce(i.starts_at::date, current_date), 'expected', 'Migrated from itinerary income', 'confirmed', 'service_revenue', i.company_id, 'itinerary', i.id
from event_itinerary_items i where i.income_amount is not null and not exists (select 1 from income x where x.itinerary_item_id = i.id);

insert into income (category, description, amount, expected_on, status, notes, certainty_status, income_kind, company_id, source_type, legacy_document_id)
select 'other', coalesce(d.doc_number, 'Invoice') || ' — ' || coalesce(d.client_name, 'Unnamed client'), d.total, coalesce(d.due_date, current_date), 'expected', 'Migrated from invoice; reconcile before merging with another Income record', case when d.status = 'draft' then 'potential' else 'confirmed' end, 'service_revenue', d.company_id, 'manual', d.id
from documents d where d.doc_type = 'invoice' and not exists (select 1 from income i where i.legacy_document_id = d.id);

insert into income_document_links (income_id, document_id, allocated_amount)
select i.id, d.id, d.total from documents d join income i on i.legacy_document_id = d.id
where d.doc_type = 'invoice' and not exists (select 1 from income_document_links l where l.document_id = d.id);

insert into income_reconciliation_candidates (left_income_id, right_income_id, match_basis)
select least(a.id, b.id), greatest(a.id, b.id), 'Same company and amount; review whether legacy source and invoice represent one Income record'
from income a join income_document_links l on true
join documents d on d.id = l.document_id
join income b on b.id = l.income_id
where a.id <> b.id and a.source_type in ('event', 'itinerary') and a.company_id is not null and a.company_id = d.company_id and a.amount = l.allocated_amount
on conflict (left_income_id, right_income_id) do nothing;
