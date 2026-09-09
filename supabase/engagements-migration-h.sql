-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration H
-- Reusable presentation/session library. A library session holds
-- the durable content; event_itinerary_items holds each scheduled
-- delivery, including its event-specific time and speakers.
-- Run after engagements-migration-g.sql.
-- ============================================================

create table if not exists presentation_sessions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  title               text not null,
  session_type        text,
  status              text not null default 'active', -- draft | active | archived
  description         text,
  learning_objectives text,
  intended_audience   text,
  duration_minutes    integer check (duration_minutes is null or duration_minutes > 0),
  speakers            jsonb not null default '[]'::jsonb,
  av_requirements     text,
  materials_needed    text,
  planning_notes      text
);

create index if not exists idx_presentation_sessions_status
  on presentation_sessions(status);
create index if not exists idx_presentation_sessions_title
  on presentation_sessions(title);

create or replace function public.touch_presentation_sessions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_presentation_sessions_updated_at on presentation_sessions;
create trigger trg_presentation_sessions_updated_at
  before update on presentation_sessions
  for each row execute function public.touch_presentation_sessions_updated_at();

alter table event_itinerary_items
  add column if not exists presentation_session_id uuid
  references presentation_sessions(id) on delete set null;
create index if not exists idx_event_itinerary_items_presentation_session_id
  on event_itinerary_items(presentation_session_id);

alter table presentation_sessions enable row level security;
create policy "staff all presentation_sessions" on presentation_sessions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
