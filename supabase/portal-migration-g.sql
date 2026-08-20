-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration G
-- Billing address on companies + a real link from a company to its
-- Primary Contact's participant row.
--
-- Previously "Primary Contact" was just free text (contact_name/
-- contact_email) directly on companies — that person never actually
-- existed as a participant, so they couldn't show up in the Address
-- Book / Company Roster or be picked in the Org Admin dropdown
-- (which only lists actual participants). primary_contact_participant_id
-- mirrors the existing org_admin_participant_id pattern so the admin
-- UI can upsert a real participant row on save and keep pointing at
-- the same one on later edits, instead of creating a duplicate every
-- time the Overview form is saved.
--
-- Additive only. Safe to run any time after Migration F.
-- Run in the Supabase SQL editor for the project used by js/config.js.
-- ============================================================

alter table companies
  add column if not exists billing_address text,
  add column if not exists primary_contact_participant_id uuid references participants(id) on delete set null;
