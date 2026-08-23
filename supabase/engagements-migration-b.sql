-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration B
-- Adds the shared prep/planning checklist system for Speaking and
-- Training engagements. One table serves both — a row belongs to
-- exactly one parent (enforced below), never both and never
-- neither. `not_applicable` items are excluded from planning
-- progress % calculations (see checklistProgressPercent() in
-- js/admin-engagements.js). Default checklists are generated
-- client-side from a hardcoded template (same pattern as the
-- existing survey template in loadSurveyTemplate(), admin.js) —
-- no template table needed. A checklist item can optionally create
-- a real `tasks` row (task_id) so due-date/owner work also shows
-- up wherever Tasks already show up (Calendar, Tasks view,
-- Dashboard).
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after engagements-migration-a.sql and
-- calendar-migration-e.sql (needs tasks to already exist).
-- ============================================================

create table if not exists engagement_checklist_items (
  id                        uuid primary key default gen_random_uuid(),
  speaking_engagement_id    uuid references speaking_engagements(id) on delete cascade,
  training_engagement_id    uuid references training_engagements(id) on delete cascade,
  task_id                   uuid references tasks(id) on delete set null,
  title                     text not null,
  status                    text not null default 'pending', -- 'pending' | 'completed' | 'not_applicable'
  due_date                  date,
  owner                     text,
  sort_order                integer not null default 0,
  is_default                boolean not null default false,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint engagement_checklist_items_one_parent check (
    (speaking_engagement_id is not null)::int + (training_engagement_id is not null)::int = 1
  )
);
create index if not exists idx_checklist_items_speaking_id on engagement_checklist_items(speaking_engagement_id);
create index if not exists idx_checklist_items_training_id on engagement_checklist_items(training_engagement_id);
create index if not exists idx_checklist_items_sort        on engagement_checklist_items(sort_order);

create or replace function public.touch_checklist_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_checklist_items_updated_at on engagement_checklist_items;
create trigger trg_checklist_items_updated_at
  before update on engagement_checklist_items
  for each row execute function public.touch_checklist_items_updated_at();

alter table engagement_checklist_items enable row level security;
create policy "staff all engagement_checklist_items" on engagement_checklist_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
