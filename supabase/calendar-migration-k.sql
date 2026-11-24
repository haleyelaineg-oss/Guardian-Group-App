-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration K
-- Adds the Haley / Dave assignment used by standalone events.
-- Training and speaking engagements already store their people
-- in instructors and speakers respectively.
-- ============================================================

alter table public.events
  add column if not exists assigned_people jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_assigned_people_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_assigned_people_check
      check (
        jsonb_typeof(assigned_people) = 'array'
        and assigned_people <@ '["Haley", "Dave"]'::jsonb
      );
  end if;
end
$$;
