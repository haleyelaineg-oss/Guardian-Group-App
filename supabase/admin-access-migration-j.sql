-- ============================================================
-- GUARDIAN GROUP — Admin Access Hardening, Migration J
-- The admin SPA calls is_staff() after authentication. Anonymous callers
-- do not need access to this SECURITY DEFINER helper.
-- ============================================================

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_users
    where auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

