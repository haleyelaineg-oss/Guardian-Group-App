-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration H
-- Keeps optional classification entered during mobile capture so
-- it can be used when the receipt is processed from the inbox.
-- ============================================================

alter table receipt_inbox
  add column if not exists related_event_id uuid references events(id) on delete set null,
  add column if not exists suggested_description text,
  add column if not exists suggested_amount numeric,
  add column if not exists suggested_category text,
  add column if not exists suggested_expense_type text,
  add column if not exists suggested_status text,
  add column if not exists suggested_reimbursement_status text;
