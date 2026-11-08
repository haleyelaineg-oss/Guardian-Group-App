-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration K
-- Consolidate training engagements into the nine-stage status workflow.
-- Run after engagements-migration-j.sql.
-- ============================================================

update public.training_engagements
set status = case status
  when 'planning' then 'scheduled'
  when 'ready' then 'scheduled'
  when 'payment_pending' then 'invoice_sent'
  when 'cancelled' then 'cancelled_by_client'
  else status
end
where status in ('planning', 'ready', 'payment_pending', 'cancelled');

alter table public.training_engagements
  alter column status set default 'inquiry';
