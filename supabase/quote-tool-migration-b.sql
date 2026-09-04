-- Link quotes, invoices, and receipts to a calendar event. Training and
-- speaking engagements already point to events, so this one relationship
-- supports all three kinds of records without duplicating foreign keys.
alter table documents
  add column if not exists event_id uuid references events(id) on delete set null;

create index if not exists idx_documents_event_id on documents(event_id);
