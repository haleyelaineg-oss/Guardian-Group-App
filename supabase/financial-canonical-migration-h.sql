-- ============================================================
-- GUARDIAN GROUP — Financial Canonical, Migration H
-- Stores payment evidence and other supporting files for income records.
-- ============================================================

create table if not exists income_attachments (
  id uuid primary key default gen_random_uuid(),
  income_id uuid not null references income(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_income_attachments_income_id
  on income_attachments(income_id, created_at desc);

alter table income_attachments enable row level security;
create policy "staff all income attachments" on income_attachments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('income-attachments', 'income-attachments', false)
on conflict (id) do nothing;

create policy "staff all income-attachments objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'income-attachments' and public.is_staff())
  with check (bucket_id = 'income-attachments' and public.is_staff());
