-- ============================================================
-- GUARDIAN GROUP — Financial Tracking, Migration E
-- Stores the cumulative amount received for each reimbursable
-- event expense so partial reimbursements can be tracked.
-- ============================================================

alter table event_expenses
  add column if not exists reimbursement_amount numeric not null default 0;

alter table event_expenses
  drop constraint if exists event_expenses_reimbursement_amount_check;

alter table event_expenses
  add constraint event_expenses_reimbursement_amount_check
  check (reimbursement_amount >= 0 and reimbursement_amount <= amount);

-- Preserve the historic meaning of fully reimbursed records.
update event_expenses
set reimbursement_amount = amount
where reimbursement_amount = 0
  and (status = 'reimbursed' or reimbursement_status = 'reimbursed');
