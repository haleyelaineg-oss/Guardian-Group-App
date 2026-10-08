-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration I
-- Company portal roster management.
--
-- Shared company portal accounts may add and update participants
-- belonging to their own company. They cannot delete participants,
-- move participants between companies, or attach Auth users. Historical
-- attendance remains intact when a roster member is marked inactive.
-- ============================================================

grant select, insert, update on table public.participants to authenticated;

drop policy if exists "company portal adds company roster members" on public.participants;
create policy "company portal adds company roster members"
  on public.participants for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and company_id = (select public.current_portal_company_id())
    and auth_user_id is null
    and is_active is true
  );

drop policy if exists "company portal updates company roster members" on public.participants;
create policy "company portal updates company roster members"
  on public.participants for update to authenticated
  using (
    (select auth.uid()) is not null
    and company_id = (select public.current_portal_company_id())
    and auth_user_id is null
  )
  with check (
    company_id = (select public.current_portal_company_id())
    and auth_user_id is null
  );

-- Intentionally no client DELETE policy. Deactivation preserves training
-- history and avoids orphaning registrations or attendance records.
