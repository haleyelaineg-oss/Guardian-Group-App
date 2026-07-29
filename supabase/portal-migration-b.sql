-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration B
-- Run ONLY after:
--   1. portal-migration-a.sql has been run successfully, AND
--   2. the new js/register.js (using upsert_participant_for_registration
--      via RPC instead of a blind insert) is deployed to production
--      and verified with a real test registration.
--
-- This closes a temporary anon INSERT policy on `participants` that
-- exists only to keep the OLD register.js working during the rollout.
-- Leaving it open longer than necessary widens the write surface on
-- that table unnecessarily.
-- ============================================================

drop policy "TEMP anon insert fallback — remove in Migration B" on participants;
