-- ============================================================
-- GUARDIAN GROUP — Training Attendance Roster, Migration I
-- Connects a contracted training engagement to participant-level
-- attendance records that are visible in the client portal.
-- ============================================================

alter table public.attendance
  add column if not exists training_engagement_id uuid
    references public.training_engagements(id) on delete cascade,
  add column if not exists training_title text,
  add column if not exists training_date timestamptz,
  add column if not exists training_facilitator text;

create index if not exists idx_attendance_training_engagement
  on public.attendance(training_engagement_id);

create unique index if not exists attendance_training_participant_key
  on public.attendance(training_engagement_id, participant_id)
  where training_engagement_id is not null;

-- Existing checkout attendance is limited to registered rows. Staff need
-- explicit insert/delete access for the manually managed training roster.
drop policy if exists "staff insert attendance" on public.attendance;
create policy "staff insert attendance"
  on public.attendance for insert to authenticated
  with check ((select public.is_staff()));

drop policy if exists "staff delete attendance" on public.attendance;
create policy "staff delete attendance"
  on public.attendance for delete to authenticated
  using ((select public.is_staff()));
