-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration C
-- Adds: (1) a live link from event_itinerary_items back to the
-- event_travel_items row it was generated from, so "Add to
-- Itinerary" on a flight/hotel/etc. keeps its title and dates in
-- sync with the Travel Planning entry instead of drifting into a
-- stale copy; (2) event_documents, a per-trip file attachment
-- table (confirmations, receipts) scoped to a specific travel item
-- or expense, or left unlinked as a general trip document — same
-- shape as client_documents from financial-tracking-migration-a.sql,
-- backed by its own private Storage bucket.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-b.sql.
-- ============================================================

-- ============================================================
-- STEP 1: link itinerary items back to their source travel item.
-- Nullable + "on delete set null" so deleting the travel item just
-- un-links the itinerary entry rather than deleting it outright.
-- ============================================================
alter table event_itinerary_items
  add column if not exists travel_item_id uuid references event_travel_items(id) on delete set null;
create index if not exists idx_event_itinerary_items_travel_item_id on event_itinerary_items(travel_item_id);

-- ============================================================
-- STEP 2: event_documents — confirmations, receipts, etc. Scoped
-- to the event, and optionally to one specific travel item or
-- expense within it (never both).
-- ============================================================
create table if not exists event_documents (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  travel_item_id uuid references event_travel_items(id) on delete set null,
  expense_id     uuid references event_expenses(id) on delete set null,
  file_name      text not null,
  storage_path   text not null,
  file_size      bigint,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_event_documents_event_id on event_documents(event_id);
create index if not exists idx_event_documents_travel_item_id on event_documents(travel_item_id);
create index if not exists idx_event_documents_expense_id on event_documents(expense_id);

alter table event_documents enable row level security;
create policy "staff all event_documents" on event_documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============================================================
-- STEP 3: private Storage bucket for the actual files, mirroring
-- client-documents from financial-tracking-migration-a.sql — read
-- back via short-lived signed URLs, never a public link.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', false)
on conflict (id) do nothing;

create policy "staff all event-documents objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'event-documents' and public.is_staff())
  with check (bucket_id = 'event-documents' and public.is_staff());
