-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration J
-- Links a general calendar event to an existing Address Book contact.
-- ============================================================

alter table events
  add column if not exists contact_participant_id uuid
  references participants(id) on delete set null;

create index if not exists idx_events_contact_participant_id
  on events(contact_participant_id);
