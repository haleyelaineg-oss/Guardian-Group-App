-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration D
-- Merges Travel Planning into Itinerary: event_itinerary_items
-- gains the travel-logistics columns (provider, confirmation
-- number, cost, status) that used to live only on
-- event_travel_items, so the app can present one unified
-- "Itinerary" tab whose form fields change based on the item's
-- Type, instead of two separate tabs/tables kept in sync by a
-- link column.
--
-- Existing event_travel_items rows are copied over (or merged
-- into their already-linked itinerary row, if "Add to Itinerary"
-- was used on them beforehand). event_travel_items itself is NOT
-- dropped here — it's left in place, unused, as a safety net.
-- Drop it by hand once you've confirmed everything looks right in
-- the Itinerary tab.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-c.sql.
-- ============================================================

-- ============================================================
-- STEP 1: new columns on event_itinerary_items for the
-- travel-logistics fields.
-- ============================================================
alter table event_itinerary_items
  add column if not exists provider text,
  add column if not exists confirmation_number text,
  add column if not exists cost numeric;

alter table event_itinerary_items
  add column if not exists status text not null default 'planned'; -- 'planned' | 'booked' | 'cancelled'

-- ============================================================
-- STEP 2: event_documents gets its own itinerary_item_id column.
-- travel_item_id is retired from the app's perspective but left
-- in place on both tables for now.
-- ============================================================
alter table event_documents
  add column if not exists itinerary_item_id uuid references event_itinerary_items(id) on delete set null;
create index if not exists idx_event_documents_itinerary_item_id on event_documents(itinerary_item_id);

-- ============================================================
-- STEP 3: migrate event_travel_items rows into
-- event_itinerary_items. Wrapped per-row so one bad row can't
-- fail the whole migration.
--   - If a travel item already has a linked itinerary row (from
--     "Add to Itinerary"), fold the travel fields into that row.
--   - Otherwise, create a new itinerary row for it.
--   - Any documents attached to the travel item are repointed at
--     the (now-merged) itinerary row.
-- ============================================================
do $$
declare
  t record;
  v_itinerary_id uuid;
  v_item_type text;
begin
  for t in select * from event_travel_items loop
    begin
      select id into v_itinerary_id from event_itinerary_items where travel_item_id = t.id limit 1;

      if v_itinerary_id is not null then
        update event_itinerary_items
        set provider = t.provider,
            confirmation_number = t.confirmation_number,
            cost = t.cost,
            status = t.status
        where id = v_itinerary_id;
      else
        v_item_type := case t.item_type
          when 'flight' then 'departing_flight'
          when 'hotel' then 'hotel'
          when 'car_rental' then 'car_rental'
          else 'other'
        end;

        insert into event_itinerary_items (
          event_id, travel_item_id, item_type, title, starts_at, ends_at,
          provider, confirmation_number, cost, status, notes
        ) values (
          t.event_id, t.id, v_item_type, t.description, t.departs_at, t.arrives_at,
          t.provider, t.confirmation_number, t.cost, t.status, t.notes
        ) returning id into v_itinerary_id;
      end if;

      update event_documents set itinerary_item_id = v_itinerary_id where travel_item_id = t.id;
    exception when others then
      raise notice 'calendar-migration-d: could not migrate travel item % (%)', t.id, sqlerrm;
    end;
  end loop;
end $$;
