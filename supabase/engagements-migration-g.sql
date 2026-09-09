-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration G
-- Repairs legacy speaking-session times that were entered in
-- local time but saved to timestamptz as if they were UTC.
-- ============================================================

-- The admin app schedules sessions in the local America/Detroit timezone.
-- Reinterpret the old UTC wall-clock values in that timezone, preserving
-- daylight-saving offsets for every session date.
update event_itinerary_items
set
  starts_at = case
    when starts_at is null then null
    else (starts_at at time zone 'UTC') at time zone 'America/Detroit'
  end,
  ends_at = case
    when ends_at is null then null
    else (ends_at at time zone 'UTC') at time zone 'America/Detroit'
  end
where item_type = 'speaking_session';
