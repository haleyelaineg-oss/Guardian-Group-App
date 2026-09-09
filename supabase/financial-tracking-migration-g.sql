-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration G
-- Retains the source receipt after it has been attached to a
-- general business expense, which has no event_documents relation.
-- ============================================================

alter table receipt_inbox
  add column if not exists general_expense_id uuid references expenses(id) on delete set null,
  add column if not exists processed_at timestamptz;

create index if not exists idx_receipt_inbox_unprocessed
  on receipt_inbox(created_at desc)
  where processed_at is null;
