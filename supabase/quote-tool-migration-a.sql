-- ============================================================
-- GUARDIAN GROUP — Quote/Invoice/Receipt Tool, Migration A
-- Ports the quote tool's schema into THIS project (it previously
-- lived in a completely separate Supabase project, linking a
-- document to a client only by free-text name matching). Table
-- names/columns here match exactly what js/quote-tool.js already
-- expects, EXCEPT the old `clients` table is renamed to
-- `quote_clients` — this project already has a `companies` table
-- that the admin UI calls "Clients", so keeping both named
-- `clients` would be permanently confusing.
--
-- Run in the Supabase SQL editor for the project used by
-- js/config.js, any time after portal-migration-d.sql.
-- ============================================================

-- ============================================================
-- STEP 1: core tables
-- ============================================================
create table if not exists quote_clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  company_id   uuid references companies(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists service_items (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  type        text not null default 'flat',
  rate        numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists documents (
  id                    uuid primary key default gen_random_uuid(),
  doc_type              text not null,
  doc_number            text not null,
  status                text not null default 'draft',
  client_id             uuid references quote_clients(id) on delete set null,
  client_name           text,
  client_person_name    text,
  client_email          text,
  client_phone          text,
  business_contact_name text,
  business_phone        text,
  business_email        text,
  doc_date              text,
  valid_for             text,
  due_terms             text,
  payment_method        text,
  payment_method_other  text,
  items                 jsonb not null default '[]'::jsonb,
  discount_type         text default '$',
  discount_value        numeric default 0,
  subtotal              numeric default 0,
  discount_amount       numeric default 0,
  total                 numeric default 0,
  amount_paid           numeric default 0,
  balance               numeric default 0,
  notes                 text,
  parent_doc_id         uuid references documents(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists idx_documents_client_id on documents(client_id);

-- ============================================================
-- STEP 2: sequential per-type doc numbers (Q-0001 / INV-0001 /
-- R-0001), replacing the next_doc_number RPC that lived in the old
-- project. The UPDATE row-locks the counter so concurrent saves
-- can't collide on the same number.
-- ============================================================
create table if not exists doc_number_counters (
  doc_type    text primary key,
  next_number integer not null default 1
);
insert into doc_number_counters (doc_type, next_number) values
  ('quote', 1), ('invoice', 1), ('receipt', 1)
on conflict do nothing;

create or replace function public.next_doc_number(p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_num integer;
  v_prefix text;
begin
  update doc_number_counters set next_number = next_number + 1
    where doc_type = p_type
    returning next_number - 1 into v_num;
  if v_num is null then
    insert into doc_number_counters (doc_type, next_number) values (p_type, 2)
      returning next_number - 1 into v_num;
  end if;
  v_prefix := case p_type when 'quote' then 'Q' when 'invoice' then 'INV' when 'receipt' then 'R' else upper(p_type) end;
  return v_prefix || '-' || lpad(v_num::text, 4, '0');
end;
$$;
grant execute on function public.next_doc_number(text) to authenticated;

-- ============================================================
-- STEP 3: best-effort auto-link — whenever a quote_clients row is
-- created or renamed, match it to a companies row by exact
-- case-insensitive name. Mirrors the matching logic js/quote-tool.js
-- already does client-side in qtClientCompanyInput(), so no app
-- code needs to change for this to work.
-- ============================================================
create or replace function public.link_quote_client_to_company()
returns trigger language plpgsql as $$
begin
  if new.company_id is null and new.name is not null then
    select id into new.company_id from companies where lower(btrim(name)) = lower(btrim(new.name)) limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_link_quote_client_to_company on quote_clients;
create trigger trg_link_quote_client_to_company
  before insert or update of name on quote_clients
  for each row execute function public.link_quote_client_to_company();

-- ============================================================
-- STEP 4: RLS — staff-only, same posture as company_membership
-- (Migration C). The quote tool is only ever reached through the
-- logged-in admin dashboard.
-- ============================================================
alter table quote_clients        enable row level security;
alter table service_items        enable row level security;
alter table documents            enable row level security;
alter table doc_number_counters  enable row level security;

create policy "staff all quote_clients" on quote_clients
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all service_items" on service_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all documents" on documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all doc_number_counters" on doc_number_counters
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
