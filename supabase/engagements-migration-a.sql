-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration A
-- Adds the core Speaking Engagement and Training Engagement
-- lifecycle tables. These are pre-event wrappers: a speaking or
-- training opportunity can exist and be worked on (application,
-- proposal, contracting) before it's real enough to belong on the
-- Calendar. Once it's confirmed (status = Selected / Scheduled),
-- the admin UI creates exactly one linked `events` row and keeps
-- it in sync going forward — see js/admin-speaking.js and
-- js/admin-training.js for the sync logic. Nothing here changes
-- how `events`, `event_itinerary_items`, `event_expenses`,
-- `event_documents`, or `tasks` work; those remain the single
-- shared spine for anything actually on the calendar.
--
-- speaking_submissions preserves exactly what was submitted to a
-- given conference/CFP, separately from speaking_engagements —
-- the "live" session details can evolve after selection without
-- losing the historical record of what was originally submitted.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-i.sql and
-- financial-tracking-migration-c.sql (needs events, companies,
-- participants, and documents to already exist).
-- ============================================================

-- ============================================================
-- STEP 1: speaking_engagements
-- ============================================================
create table if not exists speaking_engagements (
  id                            uuid primary key default gen_random_uuid(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  event_id                      uuid references events(id) on delete set null,
  status                        text not null default 'opportunity',
    -- 'opportunity' | 'preparing_submission' | 'applied' | 'under_review' | 'selected'
    -- | 'contracting' | 'planning' | 'ready' | 'completed' | 'payment_pending' | 'closed'
    -- | 'declined' | 'withdrawn' | 'cancelled'
  event_name                    text not null,
  organization_name             text,
  event_website                 text,
  venue                         text,
  city                          text,
  region                        text,
  country                       text,
  event_start_date              date,
  event_end_date                date,
  cfp_deadline                  date,
  date_discovered               date,
  application_url               text,
  contact_name                  text,
  contact_email                 text,
  contact_phone                 text,
  speakers                      jsonb not null default '[]'::jsonb,   -- array of {name, title, email}
  requested_fee                 numeric,
  offered_fee                   numeric,
  travel_reimbursement_offered  boolean not null default false,
  travel_reimbursement_limit    numeric,
  selected_at                   timestamptz,
  notes                         text
);
create index if not exists idx_speaking_engagements_status     on speaking_engagements(status);
create index if not exists idx_speaking_engagements_event_id   on speaking_engagements(event_id);
create index if not exists idx_speaking_engagements_event_start on speaking_engagements(event_start_date);

create or replace function public.touch_speaking_engagements_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_speaking_engagements_updated_at on speaking_engagements;
create trigger trg_speaking_engagements_updated_at
  before update on speaking_engagements
  for each row execute function public.touch_speaking_engagements_updated_at();

-- ============================================================
-- STEP 2: speaking_submissions — immutable-ish historical record
-- of what was actually submitted to a conference/CFP. Multiple
-- rows per engagement are allowed (resubmissions/revisions);
-- existing rows are never overwritten by later edits to the
-- engagement's live session details.
-- ============================================================
create table if not exists speaking_submissions (
  id                              uuid primary key default gen_random_uuid(),
  speaking_engagement_id          uuid not null references speaking_engagements(id) on delete cascade,
  submitted_at                    timestamptz not null default now(),
  submitted_title                 text,
  submitted_session_type          text,
  submitted_abstract              text,
  submitted_learning_objectives   text,
  submitted_bio                   text,
  submitted_speakers              jsonb not null default '[]'::jsonb,
  requested_fee                   numeric,
  application_url                 text,
  additional_answers              jsonb not null default '{}'::jsonb,
  notes                           text,
  created_at                      timestamptz not null default now()
);
create index if not exists idx_speaking_submissions_engagement_id on speaking_submissions(speaking_engagement_id);

-- ============================================================
-- STEP 3: training_engagements — a contracted/scheduled Guardian
-- Group training job. NOT to be confused with the existing
-- training_records table, which stores an individual participant's
-- training completion history — a completely different concept
-- this migration does not touch.
-- ============================================================
create table if not exists training_engagements (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  event_id                  uuid references events(id) on delete set null,
  company_id                uuid not null references companies(id) on delete restrict,
  contact_participant_id    uuid references participants(id) on delete set null,
  status                    text not null default 'inquiry',
    -- 'inquiry' | 'proposal_sent' | 'contract_pending' | 'scheduled' | 'planning'
    -- | 'ready' | 'completed' | 'invoice_sent' | 'payment_pending' | 'paid' | 'cancelled'
  title                     text not null,
  training_type             text,
  description               text,
  delivery_method           text not null default 'in_person', -- 'in_person' | 'virtual'
  instructors               jsonb not null default '[]'::jsonb, -- array of names/objects
  starts_at                 timestamptz,
  ends_at                   timestamptz,
  time_zone                 text,
  attendee_count            integer,
  site_location             text,
  site_address              text,
  onsite_contact_name       text,
  onsite_contact_phone      text,
  site_access_notes         text,
  ppe_requirements          text,
  equipment_requirements    text,
  materials_requirements    text,
  virtual_platform          text,
  virtual_meeting_link      text,
  virtual_meeting_id        text,
  virtual_passcode          text,
  virtual_host              text,
  technical_contact         text,
  tech_check_required       boolean not null default false,
  tech_check_at             timestamptz,
  recording_allowed         boolean not null default false,
  recording_required        boolean not null default false,
  notes                     text
);
create index if not exists idx_training_engagements_status     on training_engagements(status);
create index if not exists idx_training_engagements_event_id   on training_engagements(event_id);
create index if not exists idx_training_engagements_company_id on training_engagements(company_id);
create index if not exists idx_training_engagements_starts_at  on training_engagements(starts_at);

create or replace function public.touch_training_engagements_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_training_engagements_updated_at on training_engagements;
create trigger trg_training_engagements_updated_at
  before update on training_engagements
  for each row execute function public.touch_training_engagements_updated_at();

-- ============================================================
-- STEP 4: RLS — staff-only, same posture as every other
-- operational table on this calendar/financial spine (events,
-- tasks, event_expenses, etc). These are internal admin records,
-- never client-facing.
-- ============================================================
alter table speaking_engagements enable row level security;
alter table speaking_submissions enable row level security;
alter table training_engagements enable row level security;

create policy "staff all speaking_engagements" on speaking_engagements
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all speaking_submissions" on speaking_submissions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all training_engagements" on training_engagements
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
