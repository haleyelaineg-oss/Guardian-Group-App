-- Removes only orphaned Income records created by migration D for invoices
-- that were later deleted. Engagement and manual Income are never touched.
delete from income i
where i.source_type = 'manual'
  and i.legacy_document_id is null
  and i.notes like 'Migrated from invoice%'
  and not exists (select 1 from income_document_links l where l.income_id = i.id)
  and not exists (select 1 from payment_allocations p where p.income_id = i.id);
