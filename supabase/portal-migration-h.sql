-- ============================================================
-- GUARDIAN GROUP — Client Portal, Migration H
-- One organization-level portal login per company.
--
-- This migration is additive: participant, attendance, registration,
-- membership, and historical auth links remain intact. The new portal
-- reads company-wide training records through a dedicated company login.
-- ============================================================

create table if not exists public.company_portal_accounts (
  company_id    uuid primary key references public.companies(id) on delete cascade,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  email         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint company_portal_accounts_email_not_blank
    check (length(btrim(email)) > 0)
);

alter table public.company_portal_accounts enable row level security;

-- New tables are not necessarily exposed to the Data API automatically.
-- Grant only the access needed by the authenticated admin and portal apps;
-- RLS below still decides which rows each user may see or change.
grant select, insert, update, delete on public.company_portal_accounts to authenticated;
grant select, insert, update, delete on public.company_portal_accounts to service_role;
revoke all on public.company_portal_accounts from anon;

create policy "company portal account views itself"
  on public.company_portal_accounts for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy "staff view company portal accounts"
  on public.company_portal_accounts for select to authenticated
  using ((select public.is_staff()));

create policy "staff insert company portal accounts"
  on public.company_portal_accounts for insert to authenticated
  with check ((select public.is_staff()));

create policy "staff update company portal accounts"
  on public.company_portal_accounts for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "staff delete company portal accounts"
  on public.company_portal_accounts for delete to authenticated
  using ((select public.is_staff()));

-- These helpers are used only by RLS. They are SECURITY DEFINER so the
-- authorization lookup cannot recurse through the policies it protects.
-- They are explicitly unavailable to anonymous callers.
create or replace function public.current_portal_company_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select account.company_id
  from public.company_portal_accounts account
  where account.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.portal_can_view_participant(target_participant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants participant
    join public.company_portal_accounts account
      on account.company_id = participant.company_id
    where participant.id = target_participant_id
      and account.auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.current_portal_company_id() from public, anon;
revoke all on function public.portal_can_view_participant(uuid) from public, anon;
grant execute on function public.current_portal_company_id() to authenticated;
grant execute on function public.portal_can_view_participant(uuid) to authenticated;

create policy "company portal views company participants"
  on public.participants for select to authenticated
  using (company_id = (select public.current_portal_company_id()));

create policy "company portal views company attendance"
  on public.attendance for select to authenticated
  using ((select public.portal_can_view_participant(participant_id)));

