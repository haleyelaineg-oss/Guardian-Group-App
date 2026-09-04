-- Training and Speaking Events are calendar projections of their engagement.
-- Deleting that projection deletes the linked engagement too, while retaining
-- paid Income history as manual Income and removing unpaid Income.
create or replace function public.handle_engagement_income_before_delete() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'training_engagements' then
    delete from income i
    where i.training_engagement_id = old.id
      and not exists (select 1 from payment_allocations p where p.income_id = i.id);

    update income i
    set source_type = 'manual',
        training_engagement_id = null,
        notes = concat_ws(E'\n', i.notes, 'Original training was deleted; retained because it has payment history.')
    where i.training_engagement_id = old.id;
  elsif tg_table_name = 'speaking_engagements' then
    delete from income i
    where i.speaking_engagement_id = old.id
      and not exists (select 1 from payment_allocations p where p.income_id = i.id);

    update income i
    set source_type = 'manual',
        speaking_engagement_id = null,
        notes = concat_ws(E'\n', i.notes, 'Original speaking engagement was deleted; retained because it has payment history.')
    where i.speaking_engagement_id = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_handle_training_income_before_delete on training_engagements;
create trigger trg_handle_training_income_before_delete
before delete on training_engagements
for each row execute function public.handle_engagement_income_before_delete();

drop trigger if exists trg_handle_speaking_income_before_delete on speaking_engagements;
create trigger trg_handle_speaking_income_before_delete
before delete on speaking_engagements
for each row execute function public.handle_engagement_income_before_delete();

-- Extend the Event-delete handler from migration F to remove the linked
-- Training/Speaking engagement before removing its calendar Event.
create or replace function public.handle_event_income_before_delete() returns trigger language plpgsql as $$
begin
  delete from training_engagements where event_id = old.id;
  delete from speaking_engagements where event_id = old.id;

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
