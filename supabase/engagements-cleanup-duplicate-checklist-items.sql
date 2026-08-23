-- ============================================================
-- GUARDIAN GROUP — one-off cleanup
-- Removes duplicate default checklist items created by the
-- "Generate Default Checklist" double-insert bug (fixed in code).
-- Only touches is_default rows, and only exact title duplicates on
-- the same engagement, keeping the earliest copy of each — any
-- checked-off status on the kept row is preserved. Custom
-- (is_default = false) items are never touched.
-- ============================================================

delete from engagement_checklist_items dupe
using engagement_checklist_items keeper
where dupe.is_default = true
  and keeper.is_default = true
  and coalesce(dupe.speaking_engagement_id, dupe.training_engagement_id)
    = coalesce(keeper.speaking_engagement_id, keeper.training_engagement_id)
  and dupe.title = keeper.title
  and (dupe.created_at, dupe.id) > (keeper.created_at, keeper.id);
