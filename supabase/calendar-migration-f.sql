-- ============================================================
-- GUARDIAN GROUP — Calendar, Migration F
-- Adds an overall status to events (Application Sent / Application
-- Denied / Planning / Confirmed / Cancelled / Completed), plus a
-- callable function that flips 'confirmed' events to 'completed'
-- once their end date (or start date, if no end date) has passed.
--
-- The app calls this function every time the Calendar view loads —
-- it is NOT a background cron job, so a status only flips over once
-- someone opens the admin dashboard. If you'd rather it happen even
-- when nobody's logged in, this same function can be wired up to
-- Supabase's pg_cron scheduler later; ask and it can be added.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after calendar-migration-a.sql.
-- ============================================================

alter table events
  add column if not exists status text not null default 'planning';
  -- 'application_sent' | 'application_denied' | 'planning' | 'confirmed' | 'cancelled' | 'completed'

create or replace function public.auto_complete_confirmed_events()
returns void
language sql
as $$
  update events
  set status = 'completed'
  where status = 'confirmed'
    and coalesce(ends_at, starts_at) < now();
$$;
