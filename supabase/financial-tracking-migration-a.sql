-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration A
-- Real due_date/date_paid/company_id on documents (replacing the
-- client-side guesswork the Dashboard was doing by parsing doc_date
-- + due_terms text), plus a client-scoped document attachment
-- system (signed operating agreements, etc.) backed by Supabase
-- Storage.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after quote-tool-migration-a.sql and
-- portal-migration-g.sql.
-- ============================================================

-- ============================================================
-- STEP 1: new columns on documents.
--   due_date    — real date, drives "past due" / "due within 7
--                 days" everywhere (Dashboard, Invoices list,
--                 Client Detail) instead of parsing free text.
--   date_paid   — set when an invoice/receipt is marked paid.
--   company_id  — denormalized from client_id -> quote_clients.
--                 company_id, so filtering/joining by client
--                 doesn't need a two-hop lookup every time.
-- ============================================================
alter table documents
  add column if not exists due_date date,
  add column if not exists date_paid date,
  add column if not exists company_id uuid references companies(id) on delete set null;

create index if not exists idx_documents_company_id on documents(company_id);

-- ============================================================
-- STEP 2: backfill company_id — safe, no parsing involved.
-- ============================================================
update documents d
set company_id = qc.company_id
from quote_clients qc
where d.client_id = qc.id
  and d.company_id is null
  and qc.company_id is not null;

-- ============================================================
-- STEP 3: best-effort backfill of due_date for existing invoices,
-- from doc_date (free text, e.g. "Aug 21, 2026" — Postgres parses
-- this fine as a date cast) + the day count in due_terms (e.g.
-- "Net 14"), defaulting to 14 days when no number is found. Wrapped
-- per-row so one malformed historical doc_date can't fail the
-- whole backfill — it just gets skipped and logged, and can be
-- filled in by hand from the invoice editor.
-- ============================================================
do $$
declare
  r record;
  v_days integer;
begin
  for r in
    select id, doc_date, due_terms from documents
    where doc_type = 'invoice' and due_date is null and doc_date is not null
  loop
    begin
      v_days := coalesce((regexp_match(r.due_terms, '(\d+)'))[1]::int, 14);
      update documents set due_date = (r.doc_date::date) + v_days where id = r.id;
    exception when others then
      raise notice 'financial-tracking-migration-a: could not backfill due_date for document % (doc_date=%)', r.id, r.doc_date;
    end;
  end loop;
end $$;

-- date_paid is deliberately NOT backfilled — there's no reliable
-- source for historical paid dates. Old paid invoices keep
-- date_paid null; app code falls back to doc_date for those.

-- ============================================================
-- STEP 4: client document attachments (operating agreements, etc.)
-- Scoped to a company; optionally tagged to a specific quote/
-- invoice via document_id, but doesn't have to be.
-- ============================================================
create table if not exists client_documents (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  document_id  uuid references documents(id) on delete set null,
  file_name    text not null,
  storage_path text not null,
  file_size    bigint,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_client_documents_company_id on client_documents(company_id);

alter table client_documents enable row level security;
create policy "staff all client_documents" on client_documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- STEP 5: private Storage bucket for the actual files. Private
-- (not public) since these are signed client documents — the app
-- reads them back via short-lived signed URLs, never a public link.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "staff all client-documents objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'client-documents' and public.is_staff())
  with check (bucket_id = 'client-documents' and public.is_staff());
