-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration J
-- Shared visual assets for the Sessions & Presentations library.
-- Run after engagements-migration-i.sql.
-- ============================================================

create table if not exists presentation_assets (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  category       text not null check (category in ('slide', 'graphic')),
  title          text not null check (length(trim(title)) > 0),
  description    text,
  file_name      text not null,
  file_size      bigint not null check (file_size > 0),
  mime_type      text,
  storage_path   text not null unique,
  thumbnail_path text
);

create index if not exists idx_presentation_assets_category_created
  on presentation_assets(category, created_at desc);

alter table presentation_assets enable row level security;
grant select, insert, update, delete on presentation_assets to authenticated;
create policy "staff all presentation_assets" on presentation_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('presentation-assets', 'presentation-assets', false)
on conflict (id) do nothing;

create policy "staff all presentation-assets objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'presentation-assets' and public.is_staff())
  with check (bucket_id = 'presentation-assets' and public.is_staff());
