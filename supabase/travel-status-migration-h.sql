-- Rename the itinerary status from "planned" to "planning".
update event_itinerary_items set status = 'planning' where status = 'planned';
alter table event_itinerary_items alter column status set default 'planning';
