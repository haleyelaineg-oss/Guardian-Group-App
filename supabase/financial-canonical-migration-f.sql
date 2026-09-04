-- Keep the Income source-shape constraint valid when an Event is deleted.
-- Unpaid/unallocated event income can go away with its event. If cash has
-- already been recorded, retain the accounting history as manual income.
create or replace function public.handle_event_income_before_delete() returns trigger language plpgsql as $$
begin
  -- An invoice belongs to the event operationally. Keep any payment as a
  -- direct Income payment, then remove the invoice before the event is gone.
  update payment_allocations p
  set document_id = null
  where p.document_id in (
    select d.id from documents d where d.event_id = old.id and d.doc_type = 'invoice'
  );

  delete from income i
  where i.source_type = 'manual'
    and i.legacy_document_id in (
      select d.id from documents d where d.event_id = old.id and d.doc_type = 'invoice'
    )
    and not exists (select 1 from payment_allocations p where p.income_id = i.id);

  delete from documents d
  where d.event_id = old.id and d.doc_type = 'invoice';

  delete from income i
  where (
    i.event_id = old.id
    or i.itinerary_item_id in (select id from event_itinerary_items where event_id = old.id)
  )
    and not exists (select 1 from payment_allocations p where p.income_id = i.id);

  update income i
  set source_type = 'manual',
      event_id = null,
      itinerary_item_id = null,
      notes = concat_ws(E'\n', i.notes, 'Original event was deleted; retained because it has payment history.')
  where (
    i.event_id = old.id
    or i.itinerary_item_id in (select id from event_itinerary_items where event_id = old.id)
  );

  return old;
end;
$$;

drop trigger if exists trg_handle_event_income_before_delete on events;
create trigger trg_handle_event_income_before_delete
before delete on events
for each row execute function public.handle_event_income_before_delete();
