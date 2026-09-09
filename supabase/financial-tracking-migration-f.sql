-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration F
-- A staging area for receipt files captured before the matching
-- event expense is known.
-- ============================================================

create table if not exists receipt_inbox (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null unique,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table receipt_inbox enable row level security;
create policy "staff all receipt_inbox" on receipt_inbox
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('receipt-inbox', 'receipt-inbox', false)
on conflict (id) do nothing;

create policy "staff all receipt-inbox objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipt-inbox' and public.is_staff())
  with check (bucket_id = 'receipt-inbox' and public.is_staff());
