-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration L
-- Consolidate Speaking Engagement planning stages into Confirmed.
-- Run after engagements-migration-k.sql.
-- ============================================================

update public.speaking_engagements
set status = 'confirmed'
where status in ('planning', 'ready');
