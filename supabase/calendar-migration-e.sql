-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration E
-- Adds tasks: lightweight to-dos with a due date, optionally
-- linked to a specific trip/event, shown both as chips on the
-- calendar grid (on their due date) and in a full task list panel
-- so overdue/upcoming items are visible regardless of which month
-- is currently in view.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-a.sql.
-- ============================================================

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  due_date   date,
  status     text not null default 'todo', -- 'todo' | 'done'
  event_id   uuid references events(id) on delete set null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_event_id on tasks(event_id);

create or replace function public.touch_tasks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function public.touch_tasks_updated_at();

alter table tasks enable row level security;
create policy "staff all tasks" on tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
